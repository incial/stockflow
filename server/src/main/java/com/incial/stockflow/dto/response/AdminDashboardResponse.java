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
public class AdminDashboardResponse {
    private BigDecimal totalRevenue;
    private BigDecimal totalProfit;
    private Double avgMargin;
    private Long totalItems;
    private List<ProfitByOutletResponse> profitByOutlet;
    private List<RevenueTrendPointResponse> trendData;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProfitByOutletResponse {
        private String name;
        private BigDecimal profit;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RevenueTrendPointResponse {
        private String date;
        private BigDecimal revenue;
        private BigDecimal profit;
    }
}
