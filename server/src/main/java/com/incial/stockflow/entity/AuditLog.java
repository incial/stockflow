package com.incial.stockflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_user", columnList = "user_id"),
    @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_action", columnList = "action")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @Column(nullable = false)
    private UUID userId;
    
    @Column(nullable = false)
    private String userName;
    
    @Column(nullable = false)
    private String userEmail;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole userRole;
    
    @Column(nullable = false)
    private String action;
    
    @Column(nullable = false)
    private String entityType;
    
    @Column
    private UUID entityId;
    
    @Column(columnDefinition = "TEXT")
    private String details;
    
    @Column(nullable = false)
    private String ipAddress;
    
    @Column
    private String userAgent;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;
    
    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}
