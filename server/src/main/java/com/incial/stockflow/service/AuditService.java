package com.incial.stockflow.service;


import com.incial.stockflow.dto.response.AuditLogPageResponse;
import com.incial.stockflow.entity.AuditLog;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditService {
    private static final int MAX_PAGE_SIZE = 200;
    private static final int MAX_AUDIT_LOGS = 100;

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void logAction(User user, String action, String entityType, Long entityId, String details) {
        HttpServletRequest request = getCurrentHttpRequest();

        AuditLog auditLog = AuditLog.builder()
                .userId(user.getId())
                .userName(user.getName())
                .userEmail(user.getEmail())
                .userRole(user.getRole())
                .userOutletName(user.getOutlet() != null ? user.getOutlet().getName() : null)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .ipAddress(getClientIp(request))
                .userAgent(request != null ? request.getHeader("User-Agent") : null)
                .build();

        auditLogRepository.save(auditLog);
    }

    @Transactional
    @Scheduled(fixedDelayString = "${audit.cleanup.fixed-delay-ms:900000}")
    public void cleanupOldAuditLogs() {
        long totalLogs = auditLogRepository.count();

        if (totalLogs > MAX_AUDIT_LOGS) {
            int logsToDelete = (int) (totalLogs - MAX_AUDIT_LOGS);
            auditLogRepository.deleteOldestLogs(logsToDelete);
        }
    }

    public AuditLogPageResponse getAllAuditLogs(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Direction.DESC, "timestamp")
        );
        Page<AuditLog> auditLogPage = auditLogRepository.findAll(pageable);

        return AuditLogPageResponse.builder()
                .logs(auditLogPage.getContent())
                .page(safePage)
                .size(safeSize)
                .totalElements(auditLogPage.getTotalElements())
                .totalPages(auditLogPage.getTotalPages())
                .build();
    }

    private HttpServletRequest getCurrentHttpRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "Unknown";
        }

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0];
        }

        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "Unknown";
    }
}
