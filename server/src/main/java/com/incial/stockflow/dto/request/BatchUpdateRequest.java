package com.incial.stockflow.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class BatchUpdateRequest {
    
    @NotNull(message = "Batch ID is required")
    private UUID batchId;
    
    private String batchName;
    
    private Boolean isChecked;
}
