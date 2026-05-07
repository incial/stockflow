package com.incial.stockflow.service;


import com.incial.stockflow.entity.AuditLog;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private static final int MAX_AUDIT_LOGS = 50;

    @Transactional
    public void logAction(User user, String action, String entityType, Long entityId, String details) {
        HttpServletRequest request = getCurrentHttpRequest();

        AuditLog auditLog = AuditLog.builder()
                .userId(user.getId())
                .userName(user.getName())
                .userEmail(user.getEmail())
                .userRole(user.getRole())
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

    public List<AuditLog> getAllAuditLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return auditLogRepository.findAll(pageable).getContent();
    }

    public List<AuditLog> getAllAuditLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc();
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
