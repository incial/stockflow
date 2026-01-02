package com.incial.stockflow.repository;

import com.incial.stockflow.entity.StockEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockEntryRepository extends JpaRepository<StockEntry, UUID> {
    List<StockEntry> findByOutletIdOrderByEntryDateDescCreatedAtDesc(UUID outletId);
    List<StockEntry> findAllByOrderByEntryDateDescCreatedAtDesc();
}
