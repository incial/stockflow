package com.incial.stockflow.repository;

import com.incial.stockflow.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByUserIdOrderByTimestampDesc(UUID userId);
    List<AuditLog> findByActionOrderByTimestampDesc(String action);
    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime start, LocalDateTime end);
    List<AuditLog> findAllByOrderByTimestampDesc();
}
