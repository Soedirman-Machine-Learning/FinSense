import streamlit as st
import pandas as pd
import plotly.express as px

# ==================================================
# PAGE CONFIGURATION
# ==================================================
st.set_page_config(
    page_title="Sales Dashboard",
    page_icon="📊",
    layout="wide"
)

# ==================================================
# CUSTOM CSS
# ==================================================
st.markdown("""
<style>
.main {background-color: #F5F7FA;}
h1, h2, h3 {color: #0B3558;}

/* SIDEBAR */
div[data-testid="stSidebar"] {
    background-color: #0B3558;
}

div[data-testid="stSidebar"] * {
    color: white;
}

/* KPI BOX */
div[data-testid="metric-container"] {
    background: white;
    border: none;
    padding: 20px;
    border-radius: 18px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

/* KPI LABEL */
div[data-testid="stMetricLabel"] {
    font-size: 15px;
    color: #6B7280;
    font-weight: 500;
}

/* KPI VALUE */
div[data-testid="stMetricValue"] {
    font-size: 24px;
    font-weight: 700;
    color: #0B3558;
}

/* CHART CONTAINER */
.block-container {
    padding-top: 2rem;
}

/* MULTISELECT TAG */
.stMultiSelect [data-baseweb="tag"] {
    background-color: #E3F2FD !important;
    border-radius: 8px;
}

/* TEXT TAG */
.stMultiSelect [data-baseweb="tag"] span {
    color: #262730 !important;
    font-weight: 500;
}

/* ICON X */
.stMultiSelect [data-baseweb="tag"] svg {
    fill: #1565C0 !important;
}
            
div.stDownloadButton > button {
    background-color: #E3F2FD !important;
    color: black;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
}

div.stDownloadButton > button:hover {
    background-color: #1570C4 !important;
    color: white;
}

</style>
""", unsafe_allow_html=True)

# ==================================================
# LOAD DATA
# ==================================================
df = pd.read_csv("data/processed/transactions/transactions_clean.csv")
stock_raw = pd.read_csv("data/processed/transactions/stock_raw.csv")
transaction_raw = pd.read_csv("data/processed/transactions/transactions_raw.csv")

# ==================================================
# DATE FORMAT
# ==================================================
df["Date"] = pd.to_datetime(df["Date"])

# ==================================================
# COLOR THEME
# ==================================================
PRIMARY_COLOR = "#0B3558"

# ==================================================
# HEADER
# ==================================================
st.title("📊 Sales Dashboard Analysis")

st.markdown("""
Dashboard interaktif untuk eksplorasi data transaksi retail,
meliputi performa penjualan, revenue, analisis produk,
serta manajemen inventori.
""")

# ==================================================
# SIDEBAR
# ==================================================
st.sidebar.title("🔎 Filter Data")

# CATEGORY FILTER
category_filter = st.sidebar.multiselect(
    "Pilih Category",
    options=df["Category"].unique(),
    default=df["Category"].unique()
)

# DATE FILTER
min_date = df["Date"].min()
max_date = df["Date"].max()

date_filter = st.sidebar.date_input(
    "Pilih Rentang Tanggal",
    [min_date, max_date],
    min_value=min_date,
    max_value=max_date
)

# HANDLE SINGLE DATE
if len(date_filter) == 2:
    start_date, end_date = date_filter
else:
    start_date = end_date = date_filter[0]

# ==================================================
# FILTER DATA
# ==================================================
filtered_df = df[
    (df["Category"].isin(category_filter)) &
    (df["Date"] >= pd.to_datetime(start_date)) &
    (df["Date"] <= pd.to_datetime(end_date))
]

if filtered_df.empty:
    st.warning("Data tidak tersedia untuk filter yang dipilih.")
    st.stop()

# ==================================================
# KPI CALCULATION
# ==================================================
total_revenue = filtered_df["Revenue"].sum()
total_units = filtered_df["Units_Sold"].sum()
total_products = filtered_df["Product_Name"].nunique()

top_product = (
    filtered_df.groupby("Product_Name")["Units_Sold"]
    .sum()
    .sort_values(ascending=False)
)

top_product = (
    top_product.index[0]
    if not top_product.empty
    else "-"
)

# ==================================================
# KPI SECTION
# ==================================================
st.subheader("📌 Sales Summary")

col1, col2, col3, col4 = st.columns(4)

col1.metric(
    "Total Revenue",
    f"Rp {total_revenue:,.0f}"
)

col2.metric(
    "Units Sold",
    f"{total_units:,}"
)

col3.metric(
    "Total Products",
    total_products
)

col4.metric(
    "Top Product",
    top_product
)

# ==================================================
# TABS
# ==================================================
tab1, tab2, tab3 = st.tabs([
    "📑 Overview",
    "🛒 Product Analysis",
    "📦 Stock Analysis"
])

# ==================================================
# TAB 1 - OVERVIEW
# ==================================================
with tab1:

    # ------------------------------
    # DAILY REVENUE TREND
    # ------------------------------
    st.subheader("📈 Daily Revenue Trend")

    daily_rev = (
        filtered_df.groupby("Date")["Revenue"]
        .sum()
        .reset_index()
    )

    fig_daily = px.line(
        daily_rev,
        x="Date",
        y="Revenue"
    )

    fig_daily.update_traces(
        mode="lines+markers",
        line_color=PRIMARY_COLOR
    )

    fig_daily.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white",
    )

    st.plotly_chart(
        fig_daily,
        use_container_width=True,
        config={"displayModeBar": True}
    )

    st.info(
        "Revenue harian menunjukkan pola fluktuatif pada beberapa periode."
    )

    # ------------------------------
    # REVENUE BY CATEGORY
    # ------------------------------
    st.subheader("💰 Revenue by Category")

    category_rev = (
        filtered_df.groupby("Category")["Revenue"]
        .sum()
        .reset_index()
    )

    fig_donut = px.pie(
        category_rev,
        names="Category",
        values="Revenue",
        hole=0.5
    )

    fig_donut.update_layout(
        paper_bgcolor="white"
    )

    fig_donut.update_traces(
    textinfo='percent+label'
    )

    st.plotly_chart(
        fig_donut,
        use_container_width=True,
        config={"displayModeBar": True}
    )

    # Insight
    top_category = category_rev.sort_values(
        by="Revenue",
        ascending=False
    ).iloc[0]["Category"]

    st.info(
        f"{top_category} menjadi kategori dengan kontribusi revenue terbesar."
    )

# ==================================================
# TAB 2 - PRODUCT ANALYSIS
# ==================================================
with tab2:

    # ------------------------------
    # TOP 10 PRODUCTS
    # ------------------------------
    st.subheader("🏆 Top 10 Best Selling Products")

    top_units = (
        filtered_df.groupby("Product_Name")["Units_Sold"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
    )

    fig_top = px.bar(
        top_units,
        x="Units_Sold",
        y="Product_Name",
        orientation="h",
        color_discrete_sequence=[PRIMARY_COLOR]
    )

    fig_top.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white",
        yaxis={'categoryorder':'total ascending'}
    )

    st.plotly_chart(
        fig_top,
        use_container_width=True,
        config={"displayModeBar": True}
    )

    st.info(
        """Produk tertentu menunjukkan jumlah unit terjual
        yang lebih tinggi dibanding produk lainnya."""
    )
    
    # ------------------------------
    # TOP 10 REVENUE
    # ------------------------------
    st.subheader("💰 Top 10 Revenue Products") 
    
    top_rev = (
        filtered_df.groupby("Product_Name")["Revenue"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
    )
    
    fig_top_rev = px.bar(
        top_rev, 
        x="Revenue", 
        y="Product_Name", 
        orientation="h", 
        color_discrete_sequence=[PRIMARY_COLOR] 
    ) 
    
    fig_top_rev.update_layout( 
        plot_bgcolor="white", 
        paper_bgcolor="white", 
        yaxis={"categoryorder": "total ascending"} 
    ) 
    
    st.plotly_chart( 
        fig_top_rev, 
        use_container_width=True 
    )

    st.info(
        "Sebagian revenue terkonsentrasi pada sejumlah produk tertentu."
    )
    
    # ------------------------------
    # PARETO ANALYSIS
    # ------------------------------
    st.subheader(" 📚 Pareto Analysis Revenue")

    prod_rev = (
        filtered_df.groupby("Product_Name")["Revenue"]
        .sum()
        .sort_values(ascending=False)
    )

    cum = prod_rev.cumsum() / prod_rev.sum() * 100

    pareto_df = pd.DataFrame({
        "Product": prod_rev.index,
        "Cumulative": cum.values
    })

    fig_pareto = px.line(
        pareto_df,
        x="Product",
        y="Cumulative"
    )

    fig_pareto.update_traces(
        line_color=PRIMARY_COLOR
    )

    fig_pareto.add_hline(
        y=80,
        line_dash="dash"
    )

    fig_pareto.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white"
    )

    st.plotly_chart(
        fig_pareto,
        use_container_width=True,
        config={"displayModeBar": True}
    )

    st.info(
        "Sebagian kecil produk menyumbang mayoritas revenue."
    )

# ==================================================
# TAB 3 - STOCK ANALYSIS
# ==================================================
with tab3:

    # ------------------------------
    # STOCK IN VS UNITS SOLD
    # ------------------------------
    st.subheader(" 📋 Stock In vs Units Sold")

    fig_stock_in = px.scatter(
        filtered_df,
        x="Stock_In",
        y="Units_Sold",
        opacity=0.8
    )

    fig_stock_in.update_traces(
        marker=dict(color=PRIMARY_COLOR)
    )

    fig_stock_in.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white"
    )

    st.plotly_chart(
        fig_stock_in,
        use_container_width=True
    )

    st.info(
        "Hubungan antara stok masuk dan jumlah penjualan tidak terlalu kuat."
    )

    # ------------------------------
    # STOCK END VS UNITS SOLD
    # ------------------------------
    st.subheader("📉 Stock End vs Units Sold")

    fig_stock_end = px.scatter(
        filtered_df,
        x="Stock_End",
        y="Units_Sold",
        opacity=0.8
    )

    fig_stock_end.update_traces(
        marker=dict(color=PRIMARY_COLOR)
    )

    fig_stock_end.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white"
    )

    st.plotly_chart(
        fig_stock_end,
        use_container_width=True
    )

    st.info(
        "Stok akhir tinggi tidak selalu diikuti penjualan tinggi."
    )

    # ------------------------------
    # FAST AND SLOW MOVING PRODUCTS
    # ------------------------------
    st.subheader("🚀 Fast & Slow Moving Products")

    product_analysis = filtered_df.groupby("Product_Name").agg(
        Units_Sold=("Units_Sold", "sum"),
        Stock_In=("Stock_In", "sum"),
        Stock_End=("Stock_End", "sum")
    ).reset_index()

    product_analysis["Turnover"] = (
        product_analysis["Units_Sold"] / product_analysis["Stock_In"]
    ).round(4)

    fast_moving = (
        product_analysis
        .sort_values("Turnover", ascending=False)
        .head(5)
    )

    slow_moving = (
        product_analysis
        .sort_values("Turnover", ascending=True)
        .head(5)
    )

    col_fast, col_slow = st.columns(2)

    with col_fast:
        st.markdown("#### ⚡ Fast Moving Products")

        st.dataframe(
            fast_moving[["Product_Name", "Units_Sold", "Stock_In", "Turnover"]],
            hide_index=True,
            use_container_width=True,
            column_config={
                "Product_Name": st.column_config.TextColumn("Product Name"),
                "Units_Sold": st.column_config.NumberColumn("Units Sold"),
                "Stock_In": st.column_config.NumberColumn("Stock In"),
                "Turnover": st.column_config.NumberColumn("Turnover", format="%.4f")
            }
        )

    with col_slow:
        st.markdown("#### 🐢 Slow Moving Products")

        st.dataframe(
            slow_moving[["Product_Name", "Units_Sold", "Stock_In", "Turnover"]],
            hide_index=True,
            use_container_width=True,
            column_config={
                "Product_Name": st.column_config.TextColumn("Product Name"),
                "Units_Sold": st.column_config.NumberColumn("Units Sold"),
                "Stock_In": st.column_config.NumberColumn("Stock In"),
                "Turnover": st.column_config.NumberColumn("Turnover", format="%.4f")
            }
        )

    st.info(
        "Produk menunjukkan tingkat perputaran stok yang berbeda-beda."
    )

# ==================================================
# DOWNLOAD DATA
# ==================================================
st.subheader("⬇️ Download Data")

# Pilihan dataset
dataset_option = st.selectbox(
    "Pilih dataset (csv) yang ingin didownload.",
    ["Filtered Transactions", "Transactions Clean", "Transaction Raw", "Stock Raw"]
)

download_map = {
    "Filtered Transactions": filtered_df,
    "Transactions Clean": df,
    "Transaction Raw": transaction_raw,
    "Stock Raw": stock_raw
}

selected_df = download_map[dataset_option]

csv = selected_df.to_csv(index=False).encode("utf-8")
filename_map = {
    "Filtered Transactions": "filtered_sales_data.csv",
    "Transactions Clean": "transactions_clean.csv",
    "Transaction Raw": "transaction_raw.csv",
    "Stock Raw": "stock_raw.csv"
}

st.download_button(
    label=f"📥 Download {dataset_option}",
    data=csv,
    file_name=filename_map[dataset_option],
    mime="text/csv"
)

# ==================================================
# BUSINESS INSIGHT
# ==================================================
st.subheader("📝 Business Insights")

st.info("""
    - Produk dengan jumlah unit terjual tertinggi didominasi oleh kebutuhan harian, minuman, dan produk perawatan diri, yang menunjukkan tingginya permintaan pada kategori konsumsi rutin.
    - Sebagian besar revenue berasal dari sejumlah kecil produk tertentu, mengindikasikan adanya produk dengan kontribusi pendapatan yang jauh lebih dominan dibanding lainnya.
    - Revenue kategori menunjukkan dominasi kategori kebutuhan sehari-hari, terutama groceries dan produk konsumsi, sementara beberapa kategori lain berkontribusi lebih kecil terhadap total revenue. 
    - Revenue harian memperlihatkan pola fluktuatif dengan beberapa lonjakan signifikan pada periode tertentu yang kemungkinan dipengaruhi faktor musiman, promo, maupun perubahan permintaan konsumen.
    - Hubungan antara stok masuk dengan jumlah penjualan terlihat relatif lemah, sehingga volume stok belum tentu secara langsung menentukan tingginya penjualan.
    - Produk dengan stok akhir tinggi namun penjualan rendah mengindikasikan potensi slow-moving stock atau overstock pada sebagian produk.
    - Analisis Pareto menunjukkan sebagian besar revenue berasal dari sebagian kecil produk utama (80/20 rule).
    - Tingkat turnover antar produk berbeda-beda, menunjukkan variasi kecepatan perputaran stok dalam inventori.
""")

# ==================================================
# FOOTER
# ==================================================
st.markdown("""
<hr>
<center>
Sales Dashboard • @ CC26-PSU282🤘
</center>
""", unsafe_allow_html=True)