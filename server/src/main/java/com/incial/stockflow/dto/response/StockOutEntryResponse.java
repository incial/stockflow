package com.incial.stockflow.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class StockOutEntryResponse {

    private Long id;
    private Long outletId;
    private Long productId;
    private Integer quantity;
    private LocalDate date;
    private String reason;
}
