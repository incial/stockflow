package com.incial.stockflow.controller;

import com.incial.stockflow.dto.request.StockOutBatchRequest;
import com.incial.stockflow.entity.StockOutEntry;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.service.StockOutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stock-out")
@RequiredArgsConstructor
public class StockOutController {
    
    private final StockOutService stockOutService;
    
    @GetMapping
    public ResponseEntity<List<StockOutEntry>> getStockOutEntries(
            @RequestParam(required = false) UUID outletId,
            @AuthenticationPrincipal User currentUser) {
        List<StockOutEntry> entries = stockOutService.getStockOutEntries(outletId, currentUser);
        return ResponseEntity.ok(entries);
    }
    
    @PostMapping("/batch")
    public ResponseEntity<Map<String, Object>> addBatch(
            @Valid @RequestBody StockOutBatchRequest request,
            @AuthenticationPrincipal User currentUser) {
        List<StockOutEntry> entries = stockOutService.addBatch(request, currentUser);
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Stock out entries recorded successfully");
        response.put("totalEntries", entries.size());
        response.put("entries", entries);
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
