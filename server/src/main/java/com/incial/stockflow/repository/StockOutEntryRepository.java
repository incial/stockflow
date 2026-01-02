package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockOutEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockOutEntryRepository extends JpaRepository<StockOutEntry, UUID> {
    List<StockOutEntry> findByOutletIdOrderByDateDescCreatedAtDesc(UUID outletId);
    List<StockOutEntry> findAllByOrderByDateDescCreatedAtDesc();
}
