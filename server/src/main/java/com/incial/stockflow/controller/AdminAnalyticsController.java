package com.incial.stockflow.controller;

import com.incial.stockflow.dto.response.AdminDashboardResponse;
import com.incial.stockflow.dto.response.AdminInventoryResponse;
import com.incial.stockflow.dto.response.AdminReportsResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminAnalyticsController {
    private final AdminAnalyticsService adminAnalyticsService;

    @GetMapping("/dashboard")
    public ResponseEntity<AdminDashboardResponse> getDashboard(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(adminAnalyticsService.getDashboard(currentUser));
    }

    @GetMapping("/inventory")
    public ResponseEntity<AdminInventoryResponse> getInventory(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) Long outletId,
            @RequestParam(defaultValue = "levels") String tab,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(adminAnalyticsService.getInventory(currentUser, outletId, tab, page, size, search));
    }

    @GetMapping("/reports")
    public ResponseEntity<AdminReportsResponse> getReports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) Long outletId,
            @RequestParam(required = false) String date
    ) {
        return ResponseEntity.ok(adminAnalyticsService.getReports(currentUser, outletId, date));
    }
}
