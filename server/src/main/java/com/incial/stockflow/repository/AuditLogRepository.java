package com.incial.stockflow.repository;

import com.incial.stockflow.entity.AuditLog;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByUserIdOrderByTimestampDesc(Long userId);
    List<AuditLog> findByActionOrderByTimestampDesc(String action);
    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime start, LocalDateTime end);

    @Modifying
    @Query(value = """
        delete from audit_logs
        where id in (
            select id
            from audit_logs
            order by timestamp asc
            limit :limit
        )
    """, nativeQuery = true)
    int deleteOldestLogs(int limit);
}
