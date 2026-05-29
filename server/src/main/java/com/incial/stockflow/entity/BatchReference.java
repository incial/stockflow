package com.incial.stockflow.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "batch_references")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchReference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
}
