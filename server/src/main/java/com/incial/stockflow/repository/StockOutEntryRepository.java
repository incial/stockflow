package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockOutEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface StockOutEntryRepository extends JpaRepository<StockOutEntry, UUID> {
    interface ProductQuantityTotal {
        UUID getProductId();
        int getTotalQuantity();
    }

    List<StockOutEntry> findByOutletIdOrderByDateDescCreatedAtDesc(UUID outletId);

    List<StockOutEntry> findAllByOrderByDateDescCreatedAtDesc();

    @Query("""
        select coalesce(sum(so.quantity), 0)
        from StockOutEntry so
        where so.outlet.id = :outletId
          and so.product.id = :productId
    """)
    int totalStockOut(UUID outletId, UUID productId);

    @Query("""
        select so.product.id as productId, coalesce(sum(so.quantity), 0) as totalQuantity
        from StockOutEntry so
        where so.outlet.id = :outletId
          and so.product.id in :productIds
        group by so.product.id
    """)
    List<ProductQuantityTotal> totalStockOutByOutletAndProductIds(UUID outletId, Collection<UUID> productIds);
}
