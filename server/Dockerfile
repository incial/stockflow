FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
RUN mvn -q -B dependency:go-offline

# Copy source and build
COPY src ./src
RUN mvn -q -B clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user (security)
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy only the fat jar
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# JVM flags tuned for containers
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
