package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface StockEntryRepository extends JpaRepository<StockEntry, UUID> {
    interface ProductQuantityTotal {
        UUID getProductId();
        int getTotalQuantity();
    }

    List<StockEntry> findByOutletIdOrderByEntryDateDescCreatedAtDesc(UUID outletId);
    List<StockEntry> findAllByOrderByEntryDateDescCreatedAtDesc();
    List<StockEntry> findByBatchId(UUID batchId);
    
    @Query("""
    select coalesce(sum(se.quantity), 0)
    from StockEntry se
    where se.outlet.id = :outletId
      and se.product.id = :productId
""")
    int totalStockIn(UUID outletId, UUID productId);

    @Query("""
    select se.product.id as productId, coalesce(sum(se.quantity), 0) as totalQuantity
    from StockEntry se
    where se.outlet.id = :outletId
      and se.product.id in :productIds
    group by se.product.id
""")
    List<ProductQuantityTotal> totalStockInByOutletAndProductIds(UUID outletId, Collection<UUID> productIds);
}
