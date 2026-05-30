package com.incial.stockflow.service;

import com.incial.stockflow.dto.response.AdminDashboardResponse;
import com.incial.stockflow.dto.response.AdminInventoryResponse;
import com.incial.stockflow.dto.response.AdminReportsResponse;
import com.incial.stockflow.dto.response.OutletSummaryResponse;
import com.incial.stockflow.entity.Outlet;
import com.incial.stockflow.entity.StockEntry;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.entity.UserRole;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.repository.OutletRepository;
import com.incial.stockflow.repository.StockEntryRepository;
import com.incial.stockflow.repository.StockOutEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final int MAX_INVENTORY_PAGE_SIZE = 100;

    private final StockEntryRepository stockEntryRepository;
    private final StockOutEntryRepository stockOutEntryRepository;
    private final OutletRepository outletRepository;

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard(User currentUser) {
        requireAdmin(currentUser);

        StockEntryRepository.DashboardTotals totals = stockEntryRepository.findDashboardTotals();

        List<AdminDashboardResponse.ProfitByOutletResponse> outletResponses = stockEntryRepository.findProfitByOutletTotals()
                .stream()
                .map(entry -> AdminDashboardResponse.ProfitByOutletResponse.builder()
                        .name(entry.getOutletName())
                        .profit(defaultAmount(entry.getProfit()))
                        .build())
                .toList();

        List<AdminDashboardResponse.RevenueTrendPointResponse> trendResponses = stockEntryRepository.findRevenueTrendPoints()
                .stream()
                .map(entry -> AdminDashboardResponse.RevenueTrendPointResponse.builder()
                        .date(entry.getEntryDate().format(DATE_FORMATTER))
                        .revenue(defaultAmount(entry.getRevenue()))
                        .profit(defaultAmount(entry.getProfit()))
                        .build())
                .toList();

        BigDecimal totalRevenue = totals != null ? defaultAmount(totals.getTotalRevenue()) : BigDecimal.ZERO;
        BigDecimal totalProfit = totals != null ? defaultAmount(totals.getTotalProfit()) : BigDecimal.ZERO;
        long totalItems = totals != null ? totals.getTotalItems() : 0L;

        double avgMargin = BigDecimal.ZERO.compareTo(totalRevenue) == 0
                ? 0.0
                : totalProfit.multiply(BigDecimal.valueOf(100))
                .divide(totalRevenue, 4, RoundingMode.HALF_UP)
                .doubleValue();

        return AdminDashboardResponse.builder()
                .totalRevenue(totalRevenue)
                .totalProfit(totalProfit)
                .avgMargin(avgMargin)
                .totalItems(totalItems)
                .profitByOutlet(outletResponses)
                .trendData(trendResponses)
                .build();
    }

    @Transactional(readOnly = true)
    public AdminInventoryResponse getInventory(
            User currentUser,
            Long outletId,
            String tab,
            int page,
            int size,
            String search
    ) {
        requireAdmin(currentUser);

        String normalizedTab = "history".equalsIgnoreCase(tab) ? "history" : "levels";
        String normalizedSearch = normalizeSearch(search);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_INVENTORY_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize);

        List<AdminInventoryResponse.InventoryLevelResponse> pagedInventoryLevels = List.of();
        List<AdminInventoryResponse.InventoryMovementResponse> pagedHistoryLog = List.of();
        long totalElements;
        int totalPages;

        if ("history".equals(normalizedTab)) {
            Page<StockOutEntryRepository.InventoryMovementView> historyPage =
                    stockOutEntryRepository.findInventoryHistory(outletId, normalizedSearch, pageRequest);

            pagedHistoryLog = historyPage.stream()
                    .map(entry -> AdminInventoryResponse.InventoryMovementResponse.builder()
                            .id(entry.getId())
                            .date(entry.getDate().format(DATE_FORMATTER))
                            .outletId(entry.getOutletId())
                            .outletName(entry.getOutletName())
                            .productId(entry.getProductId())
                            .productName(entry.getProductName())
                            .brand(entry.getBrand())
                            .quantity(entry.getQuantity())
                            .reason(entry.getReason())
                            .userName(entry.getUserName())
                            .createdAt(entry.getCreatedAt().format(DATE_TIME_FORMATTER))
                            .build())
                    .toList();

            totalElements = historyPage.getTotalElements();
            totalPages = historyPage.getTotalPages();
        } else {
            Page<StockEntryRepository.InventoryLevelView> inventoryPage =
                    stockEntryRepository.findInventoryLevels(outletId, normalizedSearch, pageRequest);

            pagedInventoryLevels = inventoryPage.stream()
                    .map(row -> {
                        int totalIn = defaultCount(row.getTotalIn());
                        int totalOut = defaultCount(row.getTotalOut());
                        return AdminInventoryResponse.InventoryLevelResponse.builder()
                                .productId(row.getProductId())
                                .productName(row.getProductName())
                                .brand(row.getBrand())
                                .outletId(row.getOutletId())
                                .outletName(row.getOutletName())
                                .totalIn(totalIn)
                                .totalOut(totalOut)
                                .available(totalIn - totalOut)
                                .build();
                    })
                    .toList();

            totalElements = inventoryPage.getTotalElements();
            totalPages = inventoryPage.getTotalPages();
        }

        return AdminInventoryResponse.builder()
                .outlets(getOutletSummaries())
                .activeTab(normalizedTab)
                .page(safePage)
                .size(safeSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .search(normalizedSearch)
                .inventoryLevels(pagedInventoryLevels)
                .historyLog(pagedHistoryLog)
                .build();
    }

    @Transactional(readOnly = true)
    public AdminReportsResponse getReports(User currentUser, Long outletId, String date) {
        requireAdmin(currentUser);

        List<AdminReportsResponse.ReportDateSummaryResponse> dateSummaries = stockEntryRepository.findReportDateSummaries(outletId).stream()
                .map(summary -> AdminReportsResponse.ReportDateSummaryResponse.builder()
                        .date(summary.getEntryDate().format(DATE_FORMATTER))
                        .batchCount(Math.toIntExact(summary.getBatchCount()))
                        .itemCount(Math.toIntExact(summary.getItemCount()))
                        .totalAmount(summary.getTotalAmount())
                        .build())
                .limit(12)
                .toList();

        String selectedDate = resolveSelectedDate(dateSummaries, date);
        boolean includeBatchDetails = date != null && !date.isBlank();
        List<AdminReportsResponse.ReportBatchResponse> batches = !includeBatchDetails || selectedDate == null
                ? List.of()
                : getReportBatches(outletId, LocalDate.parse(selectedDate, DATE_FORMATTER));

        return AdminReportsResponse.builder()
                .outlets(getOutletSummaries())
                .dates(dateSummaries)
                .selectedDate(selectedDate)
                .batches(batches)
                .build();
    }

    private List<AdminReportsResponse.ReportBatchResponse> getReportBatches(Long outletId, LocalDate entryDate) {
        List<StockEntry> entries = stockEntryRepository.findReportEntriesByOutletIdAndEntryDate(outletId, entryDate);

        Map<Long, List<StockEntry>> entriesByBatchId = new LinkedHashMap<>();
        for (StockEntry entry : entries) {
            if (entry.getBatchId() == null) {
                continue;
            }
            entriesByBatchId.computeIfAbsent(entry.getBatchId(), ignored -> new ArrayList<>()).add(entry);
        }

        List<AdminReportsResponse.ReportBatchResponse> batches = entriesByBatchId.entrySet().stream()
                .map(entry -> toBatchResponse(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(AdminReportsResponse.ReportBatchResponse::getCreatedAt).reversed())
                .toList();

        for (int index = 0; index < batches.size(); index++) {
            batches.get(index).setBatchNumber(index + 1);
        }

        return batches;
    }

    private AdminReportsResponse.ReportBatchResponse toBatchResponse(Long batchId, List<StockEntry> batchEntries) {
        StockEntry firstEntry = batchEntries.get(0);
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;

        List<AdminReportsResponse.ReportBatchEntryResponse> items = batchEntries.stream()
                .map(entry -> {
                    BigDecimal revenue = entry.getProduct().getMrp().multiply(BigDecimal.valueOf(entry.getQuantity()));
                    BigDecimal profit = revenue.subtract(entry.getAmount());
                    double margin = BigDecimal.ZERO.compareTo(revenue) == 0
                            ? 0.0
                            : profit.multiply(BigDecimal.valueOf(100))
                            .divide(revenue, 4, RoundingMode.HALF_UP)
                            .doubleValue();
                    BigDecimal marginPerBottle = entry.getQuantity() == 0
                            ? BigDecimal.ZERO
                            : profit.divide(BigDecimal.valueOf(entry.getQuantity()), 2, RoundingMode.HALF_UP);

                    return AdminReportsResponse.ReportBatchEntryResponse.builder()
                            .id(entry.getId())
                            .productId(entry.getProduct().getId())
                            .productName(entry.getProduct().getName())
                            .brand(entry.getProduct().getBrand())
                            .outletName(entry.getOutlet().getName())
                            .mrp(entry.getProduct().getMrp())
                            .quantity(entry.getQuantity())
                            .amount(entry.getAmount())
                            .profit(profit)
                            .margin(margin)
                            .marginPerBottle(marginPerBottle)
                            .build();
                })
                .toList();

        for (AdminReportsResponse.ReportBatchEntryResponse item : items) {
            totalAmount = totalAmount.add(item.getAmount());
            totalProfit = totalProfit.add(item.getProfit());
        }

        return AdminReportsResponse.ReportBatchResponse.builder()
                .batchId(batchId)
                .entryDate(firstEntry.getEntryDate().format(DATE_FORMATTER))
                .createdAt(firstEntry.getCreatedAt().format(DATE_TIME_FORMATTER))
                .batchNumber(0)
                .batchName(firstEntry.getBatchName())
                .isChecked(Boolean.TRUE.equals(firstEntry.getIsChecked()))
                .itemCount(items.size())
                .totalAmount(totalAmount)
                .totalProfit(totalProfit)
                .entries(items)
                .build();
    }

    private List<OutletSummaryResponse> getOutletSummaries() {
        return outletRepository.findAll().stream()
                .sorted(Comparator.comparing(Outlet::getName))
                .map(outlet -> OutletSummaryResponse.builder()
                        .id(outlet.getId())
                        .name(outlet.getName())
                        .location(outlet.getLocation())
                        .build())
                .toList();
    }

    private void requireAdmin(User currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can access this resource");
        }
    }

    private String resolveSelectedDate(
            List<AdminReportsResponse.ReportDateSummaryResponse> dateSummaries,
            String requestedDate
    ) {
        if (dateSummaries.isEmpty()) {
            return null;
        }

        if (requestedDate == null || requestedDate.isBlank()) {
            return dateSummaries.get(0).getDate();
        }

        try {
            String normalizedDate = LocalDate.parse(requestedDate, DATE_FORMATTER).format(DATE_FORMATTER);
            return normalizedDate;
        } catch (DateTimeParseException exception) {
            return dateSummaries.get(0).getDate();
        }
    }

    private String normalizeSearch(String search) {
        return search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private int defaultCount(Integer value) {
        return value != null ? value : 0;
    }

}
