package com.incial.stockflow.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Builder
public class StockEntryResponse {

    private UUID id;
    private UUID outletId;
    private UUID productId;
    private Integer quantity;
    private BigDecimal amount;
    private LocalDate entryDate;
    private UUID batchId;
    private JsonNode additionalData;
}

