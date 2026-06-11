![[use-case-phase-1-scope.png]]

```plantuml
left to right direction

actor "SP Secretary" as SPS
actor "Government Official\n(SP Member / Vice Mayor / Mayor)" as GOV
actor "Records Officer" as RO
actor "Platform Administrator" as PA

rectangle "Batac City LGU Document Management Platform" {
  usecase "Process SP Resolution" as UC01
  usecase "Process SP Ordinance" as UC02
  usecase "Track Document\n(QR & Routing History)" as UC03
  usecase "Review and Sign Documents" as UC04
  usecase "Manage Records and Archive" as UC07
  usecase "View Dashboard and Reports" as UC11
  usecase "Manage System Configuration" as UC10
  usecase "Manage Users and Roles" as UC12
}

SPS --> UC01
SPS --> UC02
SPS --> UC03
GOV --> UC01
GOV --> UC02
GOV --> UC04
GOV --> UC11
RO --> UC07
RO --> UC11
PA --> UC10
PA --> UC12

UC01 ..> UC03 : <<include>>
UC02 ..> UC03 : <<include>>
UC02 ..> UC04 : <<include>>
```

