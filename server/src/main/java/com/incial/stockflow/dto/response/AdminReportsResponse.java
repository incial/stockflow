package com.incial.stockflow.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminReportsResponse {
    private List<OutletSummaryResponse> outlets;
    private List<ReportDateSummaryResponse> dates;
    private String selectedDate;
    private List<ReportBatchResponse> batches;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportDateSummaryResponse {
        private String date;
        private Integer batchCount;
        private Integer itemCount;
        private BigDecimal totalAmount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportBatchResponse {
        private Long batchId;
        private String entryDate;
        private String createdAt;
        private Integer batchNumber;
        private String batchName;
        private Boolean isChecked;
        private Integer itemCount;
        private BigDecimal totalAmount;
        private BigDecimal totalProfit;
        private List<ReportBatchEntryResponse> entries;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportBatchEntryResponse {
        private Long id;
        private Long productId;
        private String productName;
        private String brand;
        private String outletName;
        private BigDecimal mrp;
        private Integer quantity;
        private BigDecimal amount;
        private BigDecimal profit;
        private Double margin;
        private BigDecimal marginPerBottle;
    }
}
