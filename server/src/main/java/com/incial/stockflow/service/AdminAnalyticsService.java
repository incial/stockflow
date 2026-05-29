package com.incial.stockflow.service;

import com.incial.stockflow.dto.response.AdminDashboardResponse;
import com.incial.stockflow.dto.response.AdminInventoryResponse;
import com.incial.stockflow.dto.response.AdminReportsResponse;
import com.incial.stockflow.dto.response.OutletSummaryResponse;
import com.incial.stockflow.entity.Outlet;
import com.incial.stockflow.entity.Product;
import com.incial.stockflow.entity.StockEntry;
import com.incial.stockflow.entity.StockOutEntry;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.entity.UserRole;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.repository.OutletRepository;
import com.incial.stockflow.repository.StockEntryRepository;
import com.incial.stockflow.repository.StockOutEntryRepository;
import lombok.RequiredArgsConstructor;
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
import java.util.Locale;
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

        List<StockEntry> entries = stockEntryRepository.findAllWithProductAndOutletOrderByEntryDateDescCreatedAtDesc();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        long totalItems = 0L;
        Map<String, BigDecimal> profitByOutlet = new LinkedHashMap<>();
        Map<String, TrendAccumulator> trendMap = new LinkedHashMap<>();

        for (StockEntry entry : entries) {
            BigDecimal revenue = entry.getProduct().getMrp().multiply(BigDecimal.valueOf(entry.getQuantity()));
            BigDecimal profit = revenue.subtract(entry.getAmount());

            totalRevenue = totalRevenue.add(revenue);
            totalProfit = totalProfit.add(profit);
            totalItems += entry.getQuantity();
            profitByOutlet.merge(entry.getOutlet().getName(), profit, BigDecimal::add);

            String date = entry.getEntryDate().format(DATE_FORMATTER);
            TrendAccumulator accumulator = trendMap.computeIfAbsent(date, ignored -> new TrendAccumulator());
            accumulator.revenue = accumulator.revenue.add(revenue);
            accumulator.profit = accumulator.profit.add(profit);
        }

        List<AdminDashboardResponse.ProfitByOutletResponse> outletResponses = profitByOutlet.entrySet().stream()
                .map(entry -> AdminDashboardResponse.ProfitByOutletResponse.builder()
                        .name(entry.getKey())
                        .profit(entry.getValue())
                        .build())
                .toList();

        List<AdminDashboardResponse.RevenueTrendPointResponse> trendResponses = trendMap.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> AdminDashboardResponse.RevenueTrendPointResponse.builder()
                        .date(entry.getKey())
                        .revenue(entry.getValue().revenue)
                        .profit(entry.getValue().profit)
                        .build())
                .toList();

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
        String normalizedSearch = search != null ? search.trim().toLowerCase(Locale.ROOT) : "";
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_INVENTORY_PAGE_SIZE);

        List<StockEntry> stockEntries = outletId != null
                ? stockEntryRepository.findByOutletIdWithProductAndOutletOrderByEntryDateDescCreatedAtDesc(outletId)
                : stockEntryRepository.findAllWithProductAndOutletOrderByEntryDateDescCreatedAtDesc();
        List<StockOutEntry> stockOutEntries = outletId != null
                ? stockOutEntryRepository.findByOutletIdWithRelationsOrderByDateDescCreatedAtDesc(outletId)
                : stockOutEntryRepository.findAllWithRelationsOrderByDateDescCreatedAtDesc();

        Map<String, InventoryAccumulator> inventoryMap = new LinkedHashMap<>();
        for (StockEntry entry : stockEntries) {
            String key = inventoryKey(entry.getOutlet().getId(), entry.getProduct().getId());
            InventoryAccumulator accumulator = inventoryMap.computeIfAbsent(
                    key,
                    ignored -> new InventoryAccumulator(entry.getOutlet(), entry.getProduct())
            );
            accumulator.totalIn += entry.getQuantity();
            accumulator.available += entry.getQuantity();
        }

        for (StockOutEntry entry : stockOutEntries) {
            String key = inventoryKey(entry.getOutlet().getId(), entry.getProduct().getId());
            InventoryAccumulator accumulator = inventoryMap.computeIfAbsent(
                    key,
                    ignored -> new InventoryAccumulator(entry.getOutlet(), entry.getProduct())
            );
            accumulator.totalOut += entry.getQuantity();
            accumulator.available -= entry.getQuantity();
        }

        List<AdminInventoryResponse.InventoryLevelResponse> inventoryLevels = inventoryMap.values().stream()
                .filter(accumulator -> accumulator.totalIn > 0 || accumulator.totalOut > 0)
                .sorted(Comparator
                        .comparing((InventoryAccumulator accumulator) -> accumulator.outlet.getName())
                        .thenComparing(accumulator -> accumulator.product.getBrand())
                        .thenComparing(accumulator -> accumulator.product.getName()))
                .map(accumulator -> AdminInventoryResponse.InventoryLevelResponse.builder()
                        .productId(accumulator.product.getId())
                        .productName(accumulator.product.getName())
                        .brand(accumulator.product.getBrand())
                        .outletId(accumulator.outlet.getId())
                        .outletName(accumulator.outlet.getName())
                        .totalIn(accumulator.totalIn)
                        .totalOut(accumulator.totalOut)
                        .available(accumulator.available)
                        .build())
                .filter(row -> matchesInventoryLevel(row, normalizedSearch))
                .toList();

        List<AdminInventoryResponse.InventoryMovementResponse> historyLog = stockOutEntries.stream()
                .map(entry -> AdminInventoryResponse.InventoryMovementResponse.builder()
                        .id(entry.getId())
                        .date(entry.getDate().format(DATE_FORMATTER))
                        .outletId(entry.getOutlet().getId())
                        .outletName(entry.getOutlet().getName())
                        .productId(entry.getProduct().getId())
                        .productName(entry.getProduct().getName())
                        .brand(entry.getProduct().getBrand())
                        .quantity(entry.getQuantity())
                        .reason(entry.getReason().name())
                        .userName(entry.getEnteredBy().getName())
                        .createdAt(entry.getCreatedAt().format(DATE_TIME_FORMATTER))
                        .build())
                .filter(log -> matchesInventoryHistory(log, normalizedSearch))
                .toList();

        int safeResolvedSize = safeSize;
        List<AdminInventoryResponse.InventoryLevelResponse> pagedInventoryLevels =
                "levels".equals(normalizedTab)
                        ? paginate(inventoryLevels, safePage, safeResolvedSize)
                        : List.of();
        List<AdminInventoryResponse.InventoryMovementResponse> pagedHistoryLog =
                "history".equals(normalizedTab)
                        ? paginate(historyLog, safePage, safeResolvedSize)
                        : List.of();

        long totalElements = "history".equals(normalizedTab) ? historyLog.size() : inventoryLevels.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeResolvedSize);

        return AdminInventoryResponse.builder()
                .outlets(getOutletSummaries())
                .activeTab(normalizedTab)
                .page(safePage)
                .size(safeResolvedSize)
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
            boolean exists = dateSummaries.stream().anyMatch(summary -> summary.getDate().equals(normalizedDate));
            return exists ? normalizedDate : dateSummaries.get(0).getDate();
        } catch (DateTimeParseException exception) {
            return dateSummaries.get(0).getDate();
        }
    }

    private boolean matchesInventoryLevel(
            AdminInventoryResponse.InventoryLevelResponse row,
            String search
    ) {
        if (search == null || search.isBlank()) {
            return true;
        }

        return row.getProductName().toLowerCase(Locale.ROOT).contains(search)
                || row.getBrand().toLowerCase(Locale.ROOT).contains(search)
                || row.getOutletName().toLowerCase(Locale.ROOT).contains(search);
    }

    private boolean matchesInventoryHistory(
            AdminInventoryResponse.InventoryMovementResponse row,
            String search
    ) {
        if (search == null || search.isBlank()) {
            return true;
        }

        return row.getProductName().toLowerCase(Locale.ROOT).contains(search)
                || row.getBrand().toLowerCase(Locale.ROOT).contains(search)
                || row.getOutletName().toLowerCase(Locale.ROOT).contains(search)
                || row.getUserName().toLowerCase(Locale.ROOT).contains(search)
                || row.getReason().toLowerCase(Locale.ROOT).contains(search);
    }

    private <T> List<T> paginate(List<T> items, int page, int size) {
        int fromIndex = Math.min(page * size, items.size());
        int toIndex = Math.min(fromIndex + size, items.size());
        return items.subList(fromIndex, toIndex);
    }

    private String inventoryKey(Long outletId, Long productId) {
        return outletId + ":" + productId;
    }

    private static class TrendAccumulator {
        private BigDecimal revenue = BigDecimal.ZERO;
        private BigDecimal profit = BigDecimal.ZERO;
    }

    private static class InventoryAccumulator {
        private final Outlet outlet;
        private final Product product;
        private int totalIn;
        private int totalOut;
        private int available;

        private InventoryAccumulator(Outlet outlet, Product product) {
            this.outlet = outlet;
            this.product = product;
        }
    }
}
