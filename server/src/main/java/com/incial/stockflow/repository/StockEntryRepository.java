package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockEntry;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    interface LatestBatchInfo {
        Long getBatchId();
        LocalDate getEntryDate();
        LocalDateTime getCreatedAt();
        long getItemCount();
    }

    interface DashboardTotals {
        BigDecimal getTotalRevenue();
        BigDecimal getTotalProfit();
        long getTotalItems();
    }

    interface ProfitByOutletTotal {
        String getOutletName();
        BigDecimal getProfit();
    }

    interface RevenueTrendPoint {
        LocalDate getEntryDate();
        BigDecimal getRevenue();
        BigDecimal getProfit();
    }

    interface InventoryLevelView {
        Long getProductId();
        String getProductName();
        String getBrand();
        Long getOutletId();
        String getOutletName();
        Integer getTotalIn();
        Integer getTotalOut();
    }

    List<StockEntry> findByOutletIdOrderByEntryDateDescCreatedAtDesc(Long outletId, Pageable pageable);
    List<StockEntry> findAllByOrderByEntryDateDescCreatedAtDesc(Pageable pageable);
    List<StockEntry> findByBatchId(Long batchId);

    @Query("""
    select se
    from StockEntry se
    join fetch se.product
    join fetch se.outlet
    where se.batchId in :batchIds
    order by se.createdAt desc, se.batchId desc, se.id asc
""")
    List<StockEntry> findByBatchIdInWithProductAndOutlet(Collection<Long> batchIds);

    @Query("""
    select se
    from StockEntry se
    join fetch se.product
    join fetch se.outlet
    where se.id = :entryId
""")
    StockEntry findByIdWithProductAndOutlet(Long entryId);

    @Query("""
    select se.batchId as batchId,
           se.entryDate as entryDate,
           max(se.createdAt) as createdAt,
           count(se) as itemCount
    from StockEntry se
    where se.outlet.id = :outletId
      and se.batchId is not null
    group by se.batchId, se.entryDate
    order by max(se.createdAt) desc
""")
    List<LatestBatchInfo> findLatestBatchInfosByOutletId(Long outletId, Pageable pageable);

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
    select coalesce(sum(se.product.mrp * se.quantity), 0) as totalRevenue,
           coalesce(sum((se.product.mrp * se.quantity) - se.amount), 0) as totalProfit,
           coalesce(sum(se.quantity), 0) as totalItems
    from StockEntry se
""")
    DashboardTotals findDashboardTotals();

    @Query("""
    select se.outlet.name as outletName,
           coalesce(sum((se.product.mrp * se.quantity) - se.amount), 0) as profit
    from StockEntry se
    group by se.outlet.name
    order by se.outlet.name asc
""")
    List<ProfitByOutletTotal> findProfitByOutletTotals();

    @Query("""
    select se.entryDate as entryDate,
           coalesce(sum(se.product.mrp * se.quantity), 0) as revenue,
           coalesce(sum((se.product.mrp * se.quantity) - se.amount), 0) as profit
    from StockEntry se
    group by se.entryDate
    order by se.entryDate asc
""")
    List<RevenueTrendPoint> findRevenueTrendPoints();

    @Query(
            value = """
            with stock_in_totals as (
                select se.outlet_id, se.product_id, sum(se.quantity) as total_in
                from stock_entries se
                where (:outletId is null or se.outlet_id = :outletId)
                group by se.outlet_id, se.product_id
            ),
            stock_out_totals as (
                select so.outlet_id, so.product_id, sum(so.quantity) as total_out
                from stock_out_entries so
                where (:outletId is null or so.outlet_id = :outletId)
                group by so.outlet_id, so.product_id
            )
            select
                p.id as productId,
                p.name as productName,
                p.brand as brand,
                o.id as outletId,
                o.name as outletName,
                coalesce(si.total_in, 0) as totalIn,
                coalesce(so.total_out, 0) as totalOut
            from stock_in_totals si
            full outer join stock_out_totals so
                on so.outlet_id = si.outlet_id
               and so.product_id = si.product_id
            join outlets o on o.id = coalesce(si.outlet_id, so.outlet_id)
            join products p on p.id = coalesce(si.product_id, so.product_id)
            where (
                :search is null or :search = ''
                or lower(p.name) like concat('%', :search, '%')
                or lower(p.brand) like concat('%', :search, '%')
                or lower(o.name) like concat('%', :search, '%')
            )
            order by o.name asc, p.brand asc, p.name asc
            """,
            countQuery = """
            with stock_in_totals as (
                select se.outlet_id, se.product_id, sum(se.quantity) as total_in
                from stock_entries se
                where (:outletId is null or se.outlet_id = :outletId)
                group by se.outlet_id, se.product_id
            ),
            stock_out_totals as (
                select so.outlet_id, so.product_id, sum(so.quantity) as total_out
                from stock_out_entries so
                where (:outletId is null or so.outlet_id = :outletId)
                group by so.outlet_id, so.product_id
            )
            select count(*)
            from stock_in_totals si
            full outer join stock_out_totals so
                on so.outlet_id = si.outlet_id
               and so.product_id = si.product_id
            join outlets o on o.id = coalesce(si.outlet_id, so.outlet_id)
            join products p on p.id = coalesce(si.product_id, so.product_id)
            where (
                :search is null or :search = ''
                or lower(p.name) like concat('%', :search, '%')
                or lower(p.brand) like concat('%', :search, '%')
                or lower(o.name) like concat('%', :search, '%')
            )
            """,
            nativeQuery = true
    )
    org.springframework.data.domain.Page<InventoryLevelView> findInventoryLevels(Long outletId, String search, Pageable pageable);

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
