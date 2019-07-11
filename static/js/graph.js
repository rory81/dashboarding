queue()
    .defer(d3.csv, 'data/Salaries.csv')
    .await(makeGraphs);

function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);

    salaryData.forEach(function(d) {
        d.salary = parseInt(d.salary); //making salary integers instead of text
        d.yrs_service = parseInt(d['yrs.service']);
        d.yrs_since_phd = parseInt(d['yrs.since.phd']);
    })

    show_discipline_selector(ndx);

    show_percent_that_are_professors(ndx,'Female','#percent-of-women-professors');
    show_percent_that_are_professors(ndx,'Male','#percent-of-men-professors');

    show_gender_balance(ndx);
    show_average_salary(ndx);
    show_rank_distribution(ndx);
    
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);

    dc.renderAll();
}

function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck('discipline'));
    group = dim.group();

    dc.selectMenu('#discipline-selector')
        .dimension(dim)
        .group(group);
}

function show_percent_that_are_professors(ndx,gender,element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function(p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === 'Prof') {
                    p.are_prof++;
                }
            }
            return p;
        },

        function(p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === 'Prof') {
                    p.are_prof--;
                }
            }
            return p;
        },

        function initialise() {
            return {count: 0, are_prof: 0 };
        }
    );
    
    dc.numberDisplay(element)
        .formatNumber(d3.format('.2%'))
        .valueAccessor(function(d){
            if (d.count === 0) {
                return 0;
            } else {
                return (d.are_prof/d.count);
            }
        })
        .group(percentageThatAreProf);
}



function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();

    dc.barChart('#gender-balance')
        .width(400)
        .height(300)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel('Gender')
        .yAxis().ticks(20);
}

function show_average_salary(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));

    function add_item(p, v) {
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }

    function remove_item(p, v) {
        p.count--;
        if (p.count === 0) {
            p.total = 0;
            p.average = 0;
        }
        else {
            p.total -= v.salary;
            p.average = p.total / p.count;
        }

        return p;
    }

    function initialise() {
        return { count: 0, total: 0, average: 0 };
    }


    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialise);

    dc.barChart('#average-salary')
        .width(400)
        .height(300)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d) { //average is created by a custom reducer therfore a valueAccessor is needed to specify whcih of the 3 values actually gets plotted from initialise...total, count or average
            return d.value.average.toFixed(2);
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        // .elasticY(true)
        .xAxisLabel('Gender')
        .yAxis().ticks(4);

}

function show_rank_distribution(ndx) {
    function rankByGender(dimension, rank) {
        return dimension.group().reduce(
            function(p, v) {
                p.total++;
                if (v.rank === rank) {
                    p.match++;
                }
                return p
            },

            function(p, v) {
                p.total--;
                if (v.rank === rank) {
                    p.match--;
                }
                return p

            },

            function initialise() {
                return { total: 0, match: 0 };
            }
        );
    }
    var dim = ndx.dimension(dc.pluck('sex'));
    var profByGender = rankByGender(dim, 'Prof');
    var asstProfByGender = rankByGender(dim, 'AsstProf');
    var assocProfByGender = rankByGender(dim, 'AssocProf');

    dc.barChart('#rank-distribution')
        .width(400)
        .height(300)
        .dimension(dim)
        .group(profByGender, 'Prof')
        .stack(asstProfByGender, 'Asst Prof')
        .stack(assocProfByGender, 'Assoc Prof')
        .valueAccessor(function(d) {
            if (d.value.total > 0) {

                return (d.value.match / d.value.total) * 100;

            }
            else {
                return 0;
            }
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({ top: 10, right: 100, bottom: 30, left: 30 });
}

function show_service_to_salary_correlation(ndx){
    
    var genderColors = d3.scale.ordinal()
        .domain(['female','Male'])
        .range(['pink','blue']);
    
    var yearsDim = ndx.dimension(dc.pluck('yrs_service')); //for the bounds on the x-axis min and max_year
    var experienceDim = ndx.dimension(function(d){
        return [d.yrs_service,d.salary,d.rank,d.sex];
    });
    var experienceSalaryGroup = experienceDim.group();
    
    var minYears = yearsDim.bottom(1)[0].yrs_service;
    var maxYears = yearsDim.top(1)[0].yrs_service;
    
    dc.scatterPlot('#service-salary')
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minYears,maxYears]))
        .brushOn(false)
        .symbolSize(10)
        .clipPadding(10) //leaves room on the top
        .xAxisLabel('Years of Service')
        .yAxisLabel('Salary')
        .title(function(d) { // will be shown when you hover over a data dot
            return d.key[2] + ' earned '+ d.key[1];
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top:10, right:50, bottom:75, left:75});
}

function show_phd_to_salary_correlation(ndx){
    
    var genderColors = d3.scale.ordinal()
        .domain(['female','Male'])
        .range(['pink','blue']);
    
    var phdYearsDim = ndx.dimension(dc.pluck('yrs_since_phd')); //for the bounds on the x-axis min and max_year
    var phdExperienceDim = ndx.dimension(function(d){
        return [d.yrs_since_phd,d.salary,d.rank,d.sex];
    });
    var phdExperienceSalaryGroup = phdExperienceDim.group();
    
    var minPhdYears = phdYearsDim.bottom(1)[0].yrs_since_phd;
    var maxPhdYears = phdYearsDim.top(1)[0].yrs_since_phd;
    
    dc.scatterPlot('#phd-salary')
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhdYears,maxPhdYears]))
        .brushOn(false)
        .symbolSize(10)
        .clipPadding(10) //leaves room on the top
        .xAxisLabel('Years since PhD')
        .yAxisLabel('Salary')
        .title(function(d) { // will be shown when you hover over a data dot
            return d.key[2] + ' earned '+ d.key[1];
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(phdExperienceDim)
        .group(phdExperienceSalaryGroup)
        .margins({top:10, right:50, bottom:75, left:75});
}





