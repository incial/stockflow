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
            @RequestParam(required = false) Long outletId
    ) {
        return ResponseEntity.ok(adminAnalyticsService.getInventory(currentUser, outletId));
    }

    @GetMapping("/reports")
    public ResponseEntity<AdminReportsResponse> getReports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) Long outletId
    ) {
        return ResponseEntity.ok(adminAnalyticsService.getReports(currentUser, outletId));
    }
}
