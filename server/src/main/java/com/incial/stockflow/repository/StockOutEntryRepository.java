package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockOutEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface StockOutEntryRepository extends JpaRepository<StockOutEntry, Long> {
    interface ProductQuantityTotal {
        Long getProductId();
        int getTotalQuantity();
    }

    List<StockOutEntry> findByOutletIdOrderByDateDescCreatedAtDesc(Long outletId, Pageable pageable);

    List<StockOutEntry> findAllByOrderByDateDescCreatedAtDesc(Pageable pageable);

    @Query("""
        select coalesce(sum(so.quantity), 0)
        from StockOutEntry so
        where so.outlet.id = :outletId
          and so.product.id = :productId
    """)
    int totalStockOut(Long outletId, Long productId);

    @Query("""
        select so.product.id as productId, coalesce(sum(so.quantity), 0) as totalQuantity
        from StockOutEntry so
        where so.outlet.id = :outletId
          and so.product.id in :productIds
        group by so.product.id
    """)
    List<ProductQuantityTotal> totalStockOutByOutletAndProductIds(Long outletId, Collection<Long> productIds);
}
