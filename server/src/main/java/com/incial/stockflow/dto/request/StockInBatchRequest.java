package com.incial.stockflow.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class StockInBatchRequest {
    
    @NotNull(message = "Outlet ID is required")
    private UUID outletId;
    
    @NotNull(message = "Entry date is required")
    private LocalDate entryDate;
    
    @NotEmpty(message = "At least one item is required")
    @Valid
    private List<StockInItemRequest> items;
}
