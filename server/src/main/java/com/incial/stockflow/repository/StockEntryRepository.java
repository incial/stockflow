package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface StockEntryRepository extends JpaRepository<StockEntry, Long> {
    interface ProductQuantityTotal {
        Long getProductId();
        int getTotalQuantity();
    }

    List<StockEntry> findByOutletIdOrderByEntryDateDescCreatedAtDesc(Long outletId, Pageable pageable);
    List<StockEntry> findAllByOrderByEntryDateDescCreatedAtDesc(Pageable pageable);
    List<StockEntry> findByBatchId(Long batchId);
    boolean existsByBatchId(Long batchId);
    
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
