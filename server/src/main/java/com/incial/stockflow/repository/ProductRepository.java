package com.incial.stockflow.repository;

import com.incial.stockflow.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByNameAndBrand(String name, String brand);
    boolean existsByNameAndBrand(String name, String brand);
    List<Product> findAllByOrderByBrandAscNameAsc();
    List<Product> findByIdIn(Collection<Long> ids);
}
