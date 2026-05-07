package com.incial.stockflow.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import com.fasterxml.jackson.databind.JsonNode;

@Data
public class StockInItemRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.0", message = "Amount must be non-negative")
    private BigDecimal amount;

    private JsonNode additionalData;
}

