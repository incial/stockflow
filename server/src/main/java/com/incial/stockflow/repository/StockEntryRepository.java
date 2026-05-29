package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockEntry;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface StockEntryRepository extends JpaRepository<StockEntry, Long> {
    interface ProductQuantityTotal {
        Long getProductId();
        int getTotalQuantity();
    }

    interface BatchSummary {
        long getEntryCount();
        String getOutletName();
        String getBatchName();
    }

    interface ReportDateSummary {
        LocalDate getEntryDate();
        long getBatchCount();
        long getItemCount();
        BigDecimal getTotalAmount();
    }

    List<StockEntry> findByOutletIdOrderByEntryDateDescCreatedAtDesc(Long outletId, Pageable pageable);
    List<StockEntry> findAllByOrderByEntryDateDescCreatedAtDesc(Pageable pageable);
    List<StockEntry> findByBatchId(Long batchId);

    @Query("""
    select se
    from StockEntry se
    join fetch se.product
    join fetch se.outlet
    where (:outletId is null or se.outlet.id = :outletId)
      and se.entryDate = :entryDate
    order by se.createdAt desc, se.batchId desc, se.id asc
""")
    List<StockEntry> findReportEntriesByOutletIdAndEntryDate(Long outletId, LocalDate entryDate);

    @Query("""
    select se.entryDate as entryDate,
           count(distinct se.batchId) as batchCount,
           count(se) as itemCount,
           coalesce(sum(se.amount), 0) as totalAmount
    from StockEntry se
    where (:outletId is null or se.outlet.id = :outletId)
      and se.batchId is not null
    group by se.entryDate
    order by se.entryDate desc
""")
    List<ReportDateSummary> findReportDateSummaries(Long outletId);

    @Query("""
    select se
    from StockEntry se
    join fetch se.product
    join fetch se.outlet
    order by se.entryDate desc, se.createdAt desc
""")
    List<StockEntry> findAllWithProductAndOutletOrderByEntryDateDescCreatedAtDesc();

    @Query("""
    select se
    from StockEntry se
    join fetch se.product
    join fetch se.outlet
    where se.outlet.id = :outletId
    order by se.entryDate desc, se.createdAt desc
""")
    List<StockEntry> findByOutletIdWithProductAndOutletOrderByEntryDateDescCreatedAtDesc(Long outletId);

    @Query("""
    select count(se) as entryCount,
           outlet.name as outletName,
           max(se.batchName) as batchName
    from StockEntry se
    join se.outlet outlet
    where se.batchId = :batchId
    group by outlet.name
""")
    BatchSummary findBatchSummaryByBatchId(Long batchId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
    update StockEntry se
    set se.batchName = coalesce(:batchName, se.batchName),
        se.isChecked = coalesce(:isChecked, se.isChecked)
    where se.batchId = :batchId
""")
    int updateBatchMetadata(Long batchId, String batchName, Boolean isChecked);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
    delete from StockEntry se
    where se.batchId = :batchId
""")
    int deleteByBatchId(Long batchId);
    
    @Query("""
    select coalesce(sum(se.quantity), 0)
    from StockEntry se
    where se.outlet.id = :outletId
      and se.product.id = :productId
""")
    int totalStockIn(Long outletId, Long productId);

    @Query("""
    select se.product.id as productId, coalesce(sum(se.quantity), 0) as totalQuantity
    from StockEntry se
    where se.outlet.id = :outletId
      and se.product.id in :productIds
    group by se.product.id
""")
    List<ProductQuantityTotal> totalStockInByOutletAndProductIds(Long outletId, Collection<Long> productIds);
}
