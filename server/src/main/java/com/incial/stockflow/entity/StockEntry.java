package com.incial.stockflow.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "stock_entries",
        indexes = {
                @Index(
                        name = "idx_stock_entry_outlet_date",
                        columnList = "outlet_id, entry_date"
                ),
                @Index(
                        name = "idx_stock_entry_product_date",
                        columnList = "product_id, entry_date"
                ),
                @Index(
                        name = "idx_stock_entry_batch_id",
                        columnList = "batch_id"
                )
        }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockEntry {

    @Id
    @GeneratedValue
    private UUID id;

    // -----------------------------
    // Relations
    // -----------------------------

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entered_by", nullable = false)
    private User enteredBy;

    // -----------------------------
    // Business Fields
    // -----------------------------

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDate entryDate;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "batch_name")
    private String batchName;

    @Column(name = "is_checked")
    private Boolean isChecked = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode additionalData;

    // -----------------------------
    // Auditing
    // -----------------------------

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;


    @PrePersist
    public void prePersist() {
        if (isChecked == null) {
            isChecked = false;
        }
    }

}
