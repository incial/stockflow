package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockOutEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface StockOutEntryRepository extends JpaRepository<StockOutEntry, Long> {
    interface ProductQuantityTotal {
        Long getProductId();
        int getTotalQuantity();
    }

    interface InventoryMovementView {
        Long getId();
        java.time.LocalDate getDate();
        Long getOutletId();
        String getOutletName();
        Long getProductId();
        String getProductName();
        String getBrand();
        Integer getQuantity();
        String getReason();
        String getUserName();
        java.time.LocalDateTime getCreatedAt();
    }

    List<StockOutEntry> findByOutletIdOrderByDateDescCreatedAtDesc(Long outletId, Pageable pageable);

    List<StockOutEntry> findAllByOrderByDateDescCreatedAtDesc(Pageable pageable);

    @Query(
            value = """
            select so.id as id,
                   so.date as date,
                   outlet.id as outletId,
                   outlet.name as outletName,
                   product.id as productId,
                   product.name as productName,
                   product.brand as brand,
                   so.quantity as quantity,
                   cast(so.reason as string) as reason,
                   enteredBy.name as userName,
                   so.createdAt as createdAt
            from StockOutEntry so
            join so.outlet outlet
            join so.product product
            join so.enteredBy enteredBy
            where (:outletId is null or outlet.id = :outletId)
              and (
                    :search is null or :search = ''
                    or lower(product.name) like concat('%', :search, '%')
                    or lower(product.brand) like concat('%', :search, '%')
                    or lower(outlet.name) like concat('%', :search, '%')
                    or lower(enteredBy.name) like concat('%', :search, '%')
                    or lower(cast(so.reason as string)) like concat('%', :search, '%')
              )
            order by so.date desc, so.createdAt desc
            """,
            countQuery = """
            select count(so)
            from StockOutEntry so
            join so.outlet outlet
            join so.product product
            join so.enteredBy enteredBy
            where (:outletId is null or outlet.id = :outletId)
              and (
                    :search is null or :search = ''
                    or lower(product.name) like concat('%', :search, '%')
                    or lower(product.brand) like concat('%', :search, '%')
                    or lower(outlet.name) like concat('%', :search, '%')
                    or lower(enteredBy.name) like concat('%', :search, '%')
                    or lower(cast(so.reason as string)) like concat('%', :search, '%')
              )
            """
    )
    Page<InventoryMovementView> findInventoryHistory(Long outletId, String search, Pageable pageable);

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
