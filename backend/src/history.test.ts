import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { historyPage } from "./repositories/historyRepository.js";

test("Storico: KPI certificati, filtri, ordinamento e pagine",()=>{
 const db=new DatabaseSync(":memory:");
 try {
 db.exec(`CREATE TABLE Loads(id TEXT,commessa TEXT,cliente TEXT,camion TEXT);
 CREATE TABLE LoadingSessions(id TEXT,loadId TEXT,stato TEXT,shippedAt TEXT,operatorId TEXT);
 CREATE TABLE LoadMaterialAvailabilityShipments(loadId TEXT,warehouseDays INTEGER);
 CREATE TABLE ShipmentPlans(id TEXT,loadId TEXT,plannedDepartureDate TEXT,originalPlannedDepartureDate TEXT,plannedDepartureDateChangedAt TEXT);
 CREATE TABLE OperationalEvents(id TEXT,loadId TEXT,loadingSessionId TEXT,type TEXT,timestamp TEXT,note TEXT,operatorId TEXT);
 CREATE TABLE LoadingUnits(loadingSessionId TEXT,unitType TEXT,panelId TEXT,packageId TEXT,active INTEGER);
 CREATE TABLE Panels(id TEXT,peso REAL,volume REAL);CREATE TABLE Packages(id TEXT,numeroPannelli INTEGER,pesoTotale REAL,volumeTotale REAL);`);
 const actual=["2026-10-05T12:00:00Z","2026-10-04T12:00:00Z","2026-10-08T12:00:00Z","2026-10-06T12:00:00Z"];
 for(let i=0;i<4;i++){
  db.prepare("INSERT INTO Loads VALUES(?,?,?,?)").run(`l${i}`,i===3?"999":"265694",i===3?"Altro":"Ferrari",`C${i+1}`);
  db.prepare("INSERT INTO LoadingSessions VALUES(?,?,'SPEDITO',?,'OP')").run(`s${i}`,`l${i}`,actual[i]!);
  if(i<3){db.prepare("INSERT INTO LoadMaterialAvailabilityShipments VALUES(?,?)").run(`l${i}`,[0,1,3][i]!);
   db.prepare("INSERT INTO OperationalEvents VALUES(?,?,NULL,'SHIPMENT_PLAN_CREATED','2026-10-01T12:00:00Z',?,NULL)").run(`e${i}`,`l${i}`,JSON.stringify({id:`plan${i}`,loadId:`l${i}`,plannedDepartureDate:"2026-10-05",planningAuditVersion:1}));}
 }
 // Subsequent plans must not replace the initial date, even if the final plan matches departure.
 for(let i=0;i<2;i++)db.prepare("INSERT INTO OperationalEvents VALUES(?,?,NULL,'SHIPMENT_PLAN_UPDATED',?,?,NULL)").run(`update${i}`,"l2",`2026-10-0${i+2}T12:00:00Z`,JSON.stringify({before:{id:"plan2",loadId:"l2",plannedDepartureDate:i?"2026-10-07":"2026-10-05"},after:{plannedDepartureDate:i?"2026-10-08":"2026-10-07"}}));
 const all=historyPage(db,{pageSize:1});assert.equal(all.total,4);assert.equal(all.rows.length,1);
 assert.deepEqual(all.kpis,{respected:1,programmed:3,percentage:1/3*100,certified:3,averageDays:4/3,averageDeviationDays:4/3,planningCertified:0,rescheduled:0,rescheduledPercentage:null});
 assert.equal(all.rows[0]!.historyMetrics.originalPlannedDepartureDate,"2026-10-05");
 assert.deepEqual(historyPage(db,{page:2,pageSize:1}).kpis,all.kpis);
 for(let i=0;i<3;i++)db.prepare('INSERT INTO ShipmentPlans VALUES(?,?,?,?,?)').run(`plan${i}`,`l${i}`,i===2?'2026-10-08':'2026-10-05','2026-10-05',i===2?'2026-10-03T11:59:59.999Z':null);
 const certified=historyPage(db,{pageSize:1});assert.equal(certified.kpis.planningCertified,3);assert.equal(certified.kpis.rescheduled,1);assert.equal(certified.kpis.rescheduledPercentage,1/3*100);
 assert.deepEqual(historyPage(db,{pageSize:1,page:2}).kpis,certified.kpis);
 assert.equal(historyPage(db,{search:'265694',client:'Ferrari',from:'2026-10-08',to:'2026-10-08'}).kpis.rescheduledPercentage,100);
 assert.equal(historyPage(db,{from:'2026-10-05',to:'2026-10-05'}).kpis.averageDeviationDays,0);
 assert.equal(historyPage(db,{search:" 265694 "}).total,3);
 assert.equal(historyPage(db,{search:"Ferrari"}).total,0);assert.equal(historyPage(db,{search:"C1"}).total,0);
 assert.equal(historyPage(db,{client:"Altro"}).kpis.percentage,null);
 assert.equal(historyPage(db,{client:"Altro"}).kpis.averageDays,null);
 const zero=historyPage(db,{search:"265694",client:"Ferrari",from:"2026-10-05",to:"2026-10-05"});
 assert.equal(zero.total,1);assert.equal(zero.kpis.percentage,100);assert.equal(zero.kpis.averageDays,0);
 assert.equal(historyPage(db,{from:"2026-10-04",to:"2026-10-04"}).kpis.averageDays,1);
 assert.equal(historyPage(db,{from:"2026-10-08"}).kpis.averageDays,3);
 assert.equal(historyPage(db,{search:"absent"}).rows.length,0);
 assert.equal(historyPage(db,{search:"absent",page:999}).page,0);
 // Calendar dates are local: 22:30 UTC is the next day in Rome.
 db.prepare("UPDATE LoadingSessions SET shippedAt='2026-10-04T22:30:00Z' WHERE id='s0'").run();
 assert.equal(historyPage(db,{from:"2026-10-05",to:"2026-10-05"}).kpis.percentage,100);
 db.exec("INSERT INTO Panels VALUES('p',10,.2);INSERT INTO Packages VALUES('k',2,30,.6);INSERT INTO LoadingUnits VALUES('s0','PANEL','p',NULL,1),('s0','PACKAGE',NULL,'k',1),('s0','PANEL','p',NULL,0)");
 assert.deepEqual(historyPage(db,{from:"2026-10-05",to:"2026-10-05"}).rows[0]!.totals,{panels:3,packs:1,weight:40,volume:.8});
 db.exec(`WITH RECURSIVE n(i) AS(VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<5000)
 INSERT INTO Loads SELECT 'bulk'||i,'BULK','Test','C'||i FROM n;
 INSERT INTO LoadingSessions SELECT id,id,'SPEDITO','2026-10-09T12:00:00Z','OP' FROM Loads WHERE commessa='BULK';`);
 const bulk=historyPage(db,{search:"BULK",page:100,pageSize:25});
 assert.equal(bulk.total,5000);assert.equal(bulk.rows.length,25);assert.equal(bulk.kpis.percentage,null);
 }finally{db.close();}
});
