package com.incial.stockflow.controller;

import com.incial.stockflow.dto.request.StockOutBatchRequest;
import com.incial.stockflow.dto.response.StockOutBatchResponse;
import com.incial.stockflow.dto.response.StockOutEntryResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.service.StockOutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stock-out")
@RequiredArgsConstructor
public class StockOutController {

    private final StockOutService stockOutService;

    @GetMapping
    public ResponseEntity<List<StockOutEntryResponse>> getStockOutEntries(
            @RequestParam(required = false) UUID outletId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(
                stockOutService.getStockOutEntries(outletId, currentUser)
        );
    }

    @PostMapping("/batch")
    public ResponseEntity<StockOutBatchResponse> addBatch(
            @Valid @RequestBody StockOutBatchRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        List<StockOutEntryResponse> entries =
                stockOutService.addBatch(request, currentUser);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        StockOutBatchResponse.builder()
                                .message("Stock out entries recorded successfully")
                                .totalEntries(entries.size())
                                .entries(entries)
                                .build()
                );
    }
}
