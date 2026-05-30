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
public class RefillerReportsResponse {
    private String selectedDate;
    private List<ReportDateSummaryResponse> dates;
    private List<RefillerBatchResponse> batches;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportDateSummaryResponse {
        private String date;
        private Integer batchCount;
        private Integer itemCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RefillerBatchResponse {
        private Long batchId;
        private String entryDate;
        private String createdAt;
        private Integer batchNumber;
        private String batchName;
        private Integer itemCount;
        private List<RefillerBatchEntryResponse> entries;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RefillerBatchEntryResponse {
        private Long id;
        private Long productId;
        private String productName;
        private String brand;
        private Integer quantity;
        private BigDecimal amount;
    }
}
