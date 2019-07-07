queue()
    .defer(d3.csv,'/data/Salaries.csv')
    .await(makeGraph);

function makeGraph(error, salaryData){
    
}
