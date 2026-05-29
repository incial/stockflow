package com.incial.stockflow.controller;

import com.incial.stockflow.entity.AuditLog;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.entity.UserRole;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<AuditLog>> getAllAuditLogs(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        // Only ADMIN can access audit logs
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can access audit logs");
        }

        List<AuditLog> auditLogs = auditService.getAllAuditLogs(page, size);
        return ResponseEntity.ok(auditLogs);
    }
}
