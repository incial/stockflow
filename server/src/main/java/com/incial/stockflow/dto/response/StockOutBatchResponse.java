package com.incial.stockflow.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class StockOutBatchResponse {

    private String message;
    private int totalEntries;
    private List<StockOutEntryResponse> entries;
}
