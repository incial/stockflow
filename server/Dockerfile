# -----------------------------
# Build stage
# -----------------------------
FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /app

# Copy pom and download deps first (layer cache)
COPY pom.xml .
RUN mvn -q -B dependency:go-offline

# Copy source and build
COPY src ./src
RUN mvn -q -B clean package -DskipTests


# -----------------------------
# Runtime stage
# -----------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user (security best practice)
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy only the fat jar from build stage
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080


