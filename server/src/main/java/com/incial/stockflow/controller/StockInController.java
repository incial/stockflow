package com.incial.stockflow.controller;

import com.incial.stockflow.dto.request.BatchUpdateRequest;
import com.incial.stockflow.dto.request.RefillerStockEntryUpdateRequest;
import com.incial.stockflow.dto.request.StockInBatchRequest;
import com.incial.stockflow.dto.response.RefillerReportsResponse;
import com.incial.stockflow.dto.response.StockEntryResponse;
import com.incial.stockflow.dto.response.StockInBatchResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.service.StockInService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stock-in")
@RequiredArgsConstructor
public class StockInController {

    private final StockInService stockInService;

    @GetMapping
    public ResponseEntity<List<StockEntryResponse>> getStockEntries(
            @RequestParam(required = false) Long outletId,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "200") Integer size,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(
                stockInService.getStockEntries(outletId, page, size, currentUser)
        );
    }

    @PostMapping("/batch")
    public ResponseEntity<StockInBatchResponse> addBatch(
            @Valid @RequestBody StockInBatchRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        List<StockEntryResponse> entries =
                stockInService.addBatch(request, currentUser);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(
                        StockInBatchResponse.builder()
                                .message("Stock entries created successfully")
                                .totalEntries(entries.size())
                                .entries(entries)
                                .build()
                );
    }

    @PatchMapping("/batch")
    public ResponseEntity<Void> updateBatch(
            @Valid @RequestBody BatchUpdateRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        stockInService.updateBatch(request, currentUser);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/batch/{batchId}")
    public ResponseEntity<Void> deleteBatch(
            @PathVariable Long batchId,
            @AuthenticationPrincipal User currentUser
    ) {
        stockInService.deleteBatch(batchId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/refiller-reports")
    public ResponseEntity<RefillerReportsResponse> getRefillerReports(
            @RequestParam(required = false) String date,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(stockInService.getRefillerReports(currentUser, date));
    }

    @PatchMapping("/entry")
    public ResponseEntity<Void> updateEntry(
            @Valid @RequestBody RefillerStockEntryUpdateRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        stockInService.updateEntry(request, currentUser);
        return ResponseEntity.ok().build();
    }
}
