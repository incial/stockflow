package com.incial.stockflow.service;

import com.incial.stockflow.entity.Outlet;
import com.incial.stockflow.exception.ResourceNotFoundException;
import com.incial.stockflow.repository.OutletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OutletService {
    
    private final OutletRepository outletRepository;
    
    public List<Outlet> getAllOutlets() {
        return outletRepository.findAll();
    }
    
    public Outlet getOutletById(UUID id) {
        return outletRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outlet not found with id: " + id));
    }
}
