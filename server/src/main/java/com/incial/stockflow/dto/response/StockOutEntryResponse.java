package com.incial.stockflow.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Builder
public class StockOutEntryResponse {

    private UUID id;
    private UUID outletId;
    private UUID productId;
    private Integer quantity;
    private LocalDate date;
    private String reason;
}
