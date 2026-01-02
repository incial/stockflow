package com.incial.stockflow.repository;

import com.incial.stockflow.entity.Outlet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OutletRepository extends JpaRepository<Outlet, UUID> {
    Optional<Outlet> findByName(String name);
    boolean existsByName(String name);
}
