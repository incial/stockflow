package com.incial.stockflow.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Builder
public class StockEntryResponse {

    private Long id;
    private Long outletId;
    private Long productId;
    private Integer quantity;
    private BigDecimal amount;
    private LocalDate entryDate;
    private Long batchId;
    private String batchName;
    private Boolean isChecked;
    private JsonNode additionalData;
}

