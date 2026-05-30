package com.incial.stockflow.dto.response;

import com.incial.stockflow.entity.AuditLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogPageResponse {
    private List<AuditLog> logs;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
