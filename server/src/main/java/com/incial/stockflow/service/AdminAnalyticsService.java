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
    public AdminInventoryResponse getInventory(User currentUser, Long outletId) {
        requireAdmin(currentUser);

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
                .toList();

        return AdminInventoryResponse.builder()
                .outlets(getOutletSummaries())
                .inventoryLevels(inventoryLevels)
                .historyLog(historyLog)
                .build();
    }

    @Transactional(readOnly = true)
    public AdminReportsResponse getReports(User currentUser, Long outletId) {
        requireAdmin(currentUser);

        List<StockEntry> entries = outletId != null
                ? stockEntryRepository.findByOutletIdWithProductAndOutletOrderByEntryDateDescCreatedAtDesc(outletId)
                : stockEntryRepository.findAllWithProductAndOutletOrderByEntryDateDescCreatedAtDesc();

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

        Map<String, List<AdminReportsResponse.ReportBatchResponse>> batchesByDate = new LinkedHashMap<>();
        for (AdminReportsResponse.ReportBatchResponse batch : batches) {
            batchesByDate.computeIfAbsent(batch.getEntryDate(), ignored -> new ArrayList<>()).add(batch);
        }

        List<AdminReportsResponse.ReportDateGroupResponse> dateGroups = new ArrayList<>();
        batchesByDate.entrySet().stream()
                .sorted(Map.Entry.<String, List<AdminReportsResponse.ReportBatchResponse>>comparingByKey().reversed())
                .forEach(entry -> {
                    List<AdminReportsResponse.ReportBatchResponse> dateBatches = entry.getValue();
                    for (int index = 0; index < dateBatches.size(); index++) {
                        dateBatches.get(index).setBatchNumber(index + 1);
                    }
                    dateGroups.add(AdminReportsResponse.ReportDateGroupResponse.builder()
                            .date(entry.getKey())
                            .batches(dateBatches)
                            .build());
                });

        return AdminReportsResponse.builder()
                .outlets(getOutletSummaries())
                .dates(dateGroups)
                .build();
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
