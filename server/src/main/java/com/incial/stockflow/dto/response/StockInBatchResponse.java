package com.incial.stockflow.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class StockInBatchResponse {

    private String message;
    private int totalEntries;
    private List<StockEntryResponse> entries;
}
