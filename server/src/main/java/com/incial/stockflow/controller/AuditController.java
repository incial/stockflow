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

    /**
     * Get all audit logs (ADMIN only)
     * Returns all audit logs ordered by timestamp descending (newest first)
     */
    @GetMapping
    public ResponseEntity<List<AuditLog>> getAllAuditLogs(
            @AuthenticationPrincipal User currentUser) {

        // Only ADMIN can access audit logs
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can access audit logs");
        }

        List<AuditLog> auditLogs = auditService.getAllAuditLogs();
        return ResponseEntity.ok(auditLogs);
    }

    /**
     * Get paginated audit logs (ADMIN only)
     * Returns audit logs with pagination
     *
     * @param page Page number (0-indexed)
     * @param size Number of records per page
     */
    @GetMapping("/paginated")
    public ResponseEntity<List<AuditLog>> getAuditLogsPaginated(
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