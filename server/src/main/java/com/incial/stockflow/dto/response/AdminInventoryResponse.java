package com.incial.stockflow.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminInventoryResponse {
    private List<OutletSummaryResponse> outlets;
    private String activeTab;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private String search;
    private List<InventoryLevelResponse> inventoryLevels;
    private List<InventoryMovementResponse> historyLog;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InventoryLevelResponse {
        private Long productId;
        private String productName;
        private String brand;
        private Long outletId;
        private String outletName;
        private Integer totalIn;
        private Integer totalOut;
        private Integer available;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InventoryMovementResponse {
        private Long id;
        private String date;
        private Long outletId;
        private String outletName;
        private Long productId;
        private String productName;
        private String brand;
        private Integer quantity;
        private String reason;
        private String userName;
        private String createdAt;
    }
}
