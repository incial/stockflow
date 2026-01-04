package com.incial.stockflow.controller;

import com.incial.stockflow.entity.Outlet;
import com.incial.stockflow.service.OutletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/outlets")
@RequiredArgsConstructor
public class OutletController {
    
    private final OutletService outletService;
    
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Outlet>> getAllOutlets() {
        List<Outlet> outlets = outletService.getAllOutlets();
        return ResponseEntity.ok(outlets);
    }
}
