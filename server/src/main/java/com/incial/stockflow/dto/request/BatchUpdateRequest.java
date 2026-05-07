package com.incial.stockflow.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BatchUpdateRequest {
    
    @NotNull(message = "Batch ID is required")
    private Long batchId;
    
    private String batchName;
    
    private Boolean isChecked;
}
