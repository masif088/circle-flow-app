"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Divider,
  CardActionArea,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  SwapHoriz as TransactionIcon,
  Assessment as AssessmentIcon,
  UploadFile as ImportIcon,
  Download as ExportIcon,
  ClearAll as ClearIcon,
  CompareArrows as TransferIcon,
  Timeline as ChartIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  runTransaction,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
} from "firebase/firestore";

interface Wallet {
  id: string;
  name: string;
  type: "cash" | "bank" | "ewallet" | "other";
  total_transactions: number;
  total_credit: number;
  total_debit: number;
  current_balance: number;
}

interface WalletTransaction {
  id: string;
  time_transaction: string;
  wallet_id: string;
  wallet_name?: string;
  category: string;
  description: string;
  credit: number;
  debit: number;
  current_balance: number;
  created_at: string;
}

interface MonthlySnap {
  id: string;
  walletId: string;
  year: number;
  month: number;
  total_credit: number;
  total_debit: number;
  net_change: number;
  final_balance: number;
}

interface YearlySnap {
  id: string;
  walletId: string;
  year: number;
  total_credit: number;
  total_debit: number;
  net_change: number;
  final_balance: number;
}

export default function FinancePage() {
  const { user } = useAuth();
  const theme = useTheme();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [monthlySnaps, setMonthlySnaps] = useState<MonthlySnap[]>([]);
  const [yearlySnaps, setYearlySnaps] = useState<YearlySnap[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Wallet Dashboard Filter
  const [selectedWalletId, setSelectedWalletId] = useState<string | "all">("all");

  // Add Wallet Dialog States
  const [openAddWallet, setOpenAddWallet] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState<"cash" | "bank" | "ewallet" | "other">("bank");
  const [initialBalance, setInitialBalance] = useState<number>(0);

  // Add Transaction Dialog States
  const [openAddTx, setOpenAddTx] = useState(false);
  const [txWalletId, setTxWalletId] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txType, setTxType] = useState<"credit" | "debit">("debit");
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txTime, setTxTime] = useState(new Date().toISOString().substring(0, 16));

  // Edit Transaction Dialog States
  const [openEditTx, setOpenEditTx] = useState(false);
  const [editTxId, setEditTxId] = useState("");
  const [editTxWalletId, setEditTxWalletId] = useState("");
  const [editTxCategory, setEditTxCategory] = useState("");
  const [editTxDescription, setEditTxDescription] = useState("");
  const [editTxType, setEditTxType] = useState<"credit" | "debit">("debit");
  const [editTxAmount, setEditTxAmount] = useState<number>(0);
  const [editTxTime, setEditTxTime] = useState("");

  // Transfer Dialog States
  const [openTransfer, setOpenTransfer] = useState(false);
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferDescription, setTransferDescription] = useState("");
  const [transferTime, setTransferTime] = useState(new Date().toISOString().substring(0, 16));

  // Import CSV Dialog States
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importWalletId, setImportWalletId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    // No-op: Data is automatically synchronized in real-time via onSnapshot listeners.
  };

  useEffect(() => {
    if (!user) return;

    setTimeout(() => setLoading(true), 0);

    // 1. Listen to wallets
    const walletsQuery = query(collection(db, "wallets"), where("owner_id", "==", user.uid));
    const unsubscribeWallets = onSnapshot(walletsQuery, (snapshot) => {
      const walletsList: Wallet[] = [];
      snapshot.forEach((docSnap) => {
        walletsList.push({ id: docSnap.id, ...docSnap.data() } as Wallet);
      });
      setWallets(walletsList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to wallets:", error);
    });

    // 2. Listen to transactions
    const txQuery = query(
      collection(db, "wallet_transactions"),
      where("user_id", "==", user.uid),
      orderBy("time_transaction", "desc"),
      limit(100)
    );
    const unsubscribeTxs = onSnapshot(txQuery, (snapshot) => {
      const txList: WalletTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        txList.push({
          id: docSnap.id,
          time_transaction: data.time_transaction,
          wallet_id: data.wallet_id,
          category: data.category,
          description: data.description,
          credit: data.credit || 0,
          debit: data.debit || 0,
          current_balance: data.current_balance || 0,
          created_at: data.created_at,
        });
      });
      setTransactions(txList);
    }, (error) => {
      console.error("Error listening to transactions:", error);
    });

    // 3. Listen to monthly snaps
    const monthlyQuery = query(collection(db, "monthly_snaps"), where("owner_id", "==", user.uid));
    const unsubscribeMonthly = onSnapshot(monthlyQuery, (snapshot) => {
      const monthlyList: MonthlySnap[] = [];
      snapshot.forEach((docSnap) => {
        monthlyList.push({ id: docSnap.id, ...docSnap.data() } as MonthlySnap);
      });
      setMonthlySnaps(monthlyList);
    }, (error) => {
      console.error("Error listening to monthly snaps:", error);
    });

    // 4. Listen to yearly snaps
    const yearlyQuery = query(collection(db, "yearly_snaps"), where("owner_id", "==", user.uid));
    const unsubscribeYearly = onSnapshot(yearlyQuery, (snapshot) => {
      const yearlyList: YearlySnap[] = [];
      snapshot.forEach((docSnap) => {
        yearlyList.push({ id: docSnap.id, ...docSnap.data() } as YearlySnap);
      });
      setYearlySnaps(yearlyList);
    }, (error) => {
      console.error("Error listening to yearly snaps:", error);
    });

    return () => {
      unsubscribeWallets();
      unsubscribeTxs();
      unsubscribeMonthly();
      unsubscribeYearly();
    };
  }, [user]);

  const recordTransactionAtomically = async (txData: {
    walletId: string;
    category: string;
    description: string;
    type: "credit" | "debit";
    amount: number;
    timeTransaction: string;
  }) => {
    const { walletId, category, description, type, amount, timeTransaction } = txData;
    const dateObj = new Date(timeTransaction);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const walletRef = doc(db, "wallets", walletId);
    const transactionRef = doc(collection(db, "wallet_transactions"));
    const monthlySnapRef = doc(db, "monthly_snaps", `${walletId}_${year}_${month}`);
    const yearlySnapRef = doc(db, "yearly_snaps", `${walletId}_${year}`);

    await runTransaction(db, async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists()) {
        throw new Error("Wallet does not exist!");
      }
      const wData = walletDoc.data();
      const currentBalance = wData.current_balance || 0;
      const totalTransactions = wData.total_transactions || 0;
      const totalCredit = wData.total_credit || 0;
      const totalDebit = wData.total_debit || 0;

      const creditVal = type === "credit" ? amount : 0;
      const debitVal = type === "debit" ? amount : 0;
      const newBalance = type === "credit" ? currentBalance + amount : currentBalance - amount;

      const monthlySnapDoc = await transaction.get(monthlySnapRef);
      let mCredit = 0;
      let mDebit = 0;
      if (monthlySnapDoc.exists()) {
        const mData = monthlySnapDoc.data();
        mCredit = mData.total_credit || 0;
        mDebit = mData.total_debit || 0;
      }

      const yearlySnapDoc = await transaction.get(yearlySnapRef);
      let yCredit = 0;
      let yDebit = 0;
      if (yearlySnapDoc.exists()) {
        const yData = yearlySnapDoc.data();
        yCredit = yData.total_credit || 0;
        yDebit = yData.total_debit || 0;
      }

      transaction.update(walletRef, {
        total_transactions: totalTransactions + 1,
        total_credit: totalCredit + creditVal,
        total_debit: totalDebit + debitVal,
        current_balance: newBalance,
      });

      transaction.set(transactionRef, {
        time_transaction: dateObj.toISOString(),
        wallet_id: walletId,
        user_id: user?.uid,
        category,
        description,
        credit: creditVal,
        debit: debitVal,
        current_balance: newBalance,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      transaction.set(monthlySnapRef, {
        walletId,
        owner_id: user?.uid,
        year,
        month,
        total_credit: mCredit + creditVal,
        total_debit: mDebit + debitVal,
        net_change: (mCredit + creditVal) - (mDebit + debitVal),
        final_balance: newBalance,
      }, { merge: true });

      transaction.set(yearlySnapRef, {
        walletId,
        owner_id: user?.uid,
        year,
        total_credit: yCredit + creditVal,
        total_debit: yDebit + debitVal,
        net_change: (yCredit + creditVal) - (yDebit + debitVal),
        final_balance: newBalance,
      }, { merge: true });
    });
  };

  const handleOpenAddWallet = () => {
    setWalletName("");
    setWalletType("bank");
    setInitialBalance(0);
    setOpenAddWallet(true);
  };

  const handleCreateWallet = async () => {
    if (!walletName || !user) return;
    setSubmitting(true);
    try {
      const walletRef = doc(collection(db, "wallets"));
      const walletId = walletRef.id;

      const newWalletData = {
        name: walletName,
        type: walletType,
        total_transactions: initialBalance > 0 ? 1 : 0,
        total_credit: initialBalance > 0 ? initialBalance : 0,
        total_debit: 0,
        current_balance: initialBalance,
        owner_id: user.uid,
      };

      await setDoc(walletRef, newWalletData);

      if (initialBalance > 0) {
        const txRef = doc(collection(db, "wallet_transactions"));
        const dateObj = new Date();
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;

        await setDoc(txRef, {
          time_transaction: dateObj.toISOString(),
          wallet_id: walletId,
          user_id: user.uid,
          category: "Initial Balance",
          description: `Opening balance for ${walletName}`,
          credit: initialBalance,
          debit: 0,
          current_balance: initialBalance,
          created_at: dateObj.toISOString(),
          updated_at: dateObj.toISOString(),
        });

        await setDoc(doc(db, "monthly_snaps", `${walletId}_${year}_${month}`), {
          walletId,
          owner_id: user.uid,
          year,
          month,
          total_credit: initialBalance,
          total_debit: 0,
          net_change: initialBalance,
          final_balance: initialBalance,
        });

        await setDoc(doc(db, "yearly_snaps", `${walletId}_${year}`), {
          walletId,
          owner_id: user.uid,
          year,
          total_credit: initialBalance,
          total_debit: 0,
          net_change: initialBalance,
          final_balance: initialBalance,
        });
      }

      setOpenAddWallet(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to create wallet");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddTx = () => {
    if (wallets.length === 0) {
      alert("Please create a wallet first!");
      return;
    }
    setTxWalletId(selectedWalletId !== "all" ? selectedWalletId : wallets[0].id);
    setTxCategory("");
    setTxDescription("");
    setTxType("debit");
    setTxAmount(0);
    setTxTime(new Date().toISOString().substring(0, 16));
    setOpenAddTx(true);
  };

  const handleAddTransaction = async () => {
    if (!txWalletId || !txCategory || txAmount <= 0 || !user) return;
    setSubmitting(true);
    try {
      await recordTransactionAtomically({
        walletId: txWalletId,
        category: txCategory,
        description: txDescription,
        type: txType,
        amount: txAmount,
        timeTransaction: txTime,
      });

      setOpenAddTx(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditTx = (tx: WalletTransaction) => {
    setEditTxId(tx.id);
    setEditTxWalletId(tx.wallet_id);
    setEditTxCategory(tx.category);
    setEditTxDescription(tx.description);
    setEditTxType(tx.credit > 0 ? "credit" : "debit");
    setEditTxAmount(tx.credit > 0 ? tx.credit : tx.debit);
    setEditTxTime(new Date(tx.time_transaction).toISOString().substring(0, 16));
    setOpenEditTx(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editTxId || !editTxWalletId || !editTxCategory || editTxAmount <= 0 || !user) return;
    setSubmitting(true);
    try {
      const oldTx = transactions.find((t) => t.id === editTxId);
      if (!oldTx) return;

      const oldDate = new Date(oldTx.time_transaction);
      const oldYear = oldDate.getFullYear();
      const oldMonth = oldDate.getMonth() + 1;

      const newDate = new Date(editTxTime);
      const newYear = newDate.getFullYear();
      const newMonth = newDate.getMonth() + 1;

      await runTransaction(db, async (transaction) => {
        const oldWalletRef = doc(db, "wallets", oldTx.wallet_id);
        const newWalletRef = doc(db, "wallets", editTxWalletId);

        const oldMonthlySnapRef = doc(db, "monthly_snaps", `${oldTx.wallet_id}_${oldYear}_${oldMonth}`);
        const oldYearlySnapRef = doc(db, "yearly_snaps", `${oldTx.wallet_id}_${oldYear}`);
        const newMonthlySnapRef = doc(db, "monthly_snaps", `${editTxWalletId}_${newYear}_${newMonth}`);
        const newYearlySnapRef = doc(db, "yearly_snaps", `${editTxWalletId}_${newYear}`);

        // 1. Perform all reads first
        const oldWalletDoc = await transaction.get(oldWalletRef);
        const newWalletDoc = await transaction.get(newWalletRef);
        const oldMonthlyDoc = await transaction.get(oldMonthlySnapRef);
        const oldYearlyDoc = await transaction.get(oldYearlySnapRef);
        const newMonthlyDoc = await transaction.get(newMonthlySnapRef);
        const newYearlyDoc = await transaction.get(newYearlySnapRef);

        if (!oldWalletDoc.exists() || !newWalletDoc.exists()) {
          throw new Error("One or both wallets do not exist.");
        }

        const oldCredit = oldTx.credit || 0;
        const oldDebit = oldTx.debit || 0;

        const newCredit = editTxType === "credit" ? editTxAmount : 0;
        const newDebit = editTxType === "debit" ? editTxAmount : 0;

        // 2. Perform updates to wallets
        if (oldTx.wallet_id === editTxWalletId) {
          const wData = oldWalletDoc.data();
          const currentBalance = wData.current_balance || 0;
          const totalCredit = wData.total_credit || 0;
          const totalDebit = wData.total_debit || 0;

          const netCreditChange = newCredit - oldCredit;
          const netDebitChange = newDebit - oldDebit;
          const newBalance = currentBalance + netCreditChange - netDebitChange;

          transaction.update(oldWalletRef, {
            total_credit: totalCredit + netCreditChange,
            total_debit: totalDebit + netDebitChange,
            current_balance: newBalance,
          });
        } else {
          const oldWData = oldWalletDoc.data();
          transaction.update(oldWalletRef, {
            total_credit: Math.max(0, (oldWData.total_credit || 0) - oldCredit),
            total_debit: Math.max(0, (oldWData.total_debit || 0) - oldDebit),
            current_balance: (oldWData.current_balance || 0) - oldCredit + oldDebit,
          });

          const newWData = newWalletDoc.data();
          transaction.update(newWalletRef, {
            total_credit: (newWData.total_credit || 0) + newCredit,
            total_debit: (newWData.total_debit || 0) + newDebit,
            current_balance: (newWData.current_balance || 0) + newCredit - newDebit,
          });
        }

        // 3. Revert old snapshot balances (writes)
        if (oldMonthlyDoc.exists()) {
          const oMData = oldMonthlyDoc.data();
          transaction.set(oldMonthlySnapRef, {
            total_credit: Math.max(0, (oMData.total_credit || 0) - oldCredit),
            total_debit: Math.max(0, (oMData.total_debit || 0) - oldDebit),
            net_change: ((oMData.total_credit || 0) - oldCredit) - ((oMData.total_debit || 0) - oldDebit),
          }, { merge: true });
        }

        if (oldYearlyDoc.exists()) {
          const oYData = oldYearlyDoc.data();
          transaction.set(oldYearlySnapRef, {
            total_credit: Math.max(0, (oYData.total_credit || 0) - oldCredit),
            total_debit: Math.max(0, (oYData.total_debit || 0) - oldDebit),
            net_change: ((oYData.total_credit || 0) - oldCredit) - ((oYData.total_debit || 0) - oldDebit),
          }, { merge: true });
        }

        // 4. Apply new snapshot balances (writes)
        const nMData = newMonthlyDoc.exists() ? newMonthlyDoc.data() : { total_credit: 0, total_debit: 0 };
        transaction.set(newMonthlySnapRef, {
          walletId: editTxWalletId,
          owner_id: user.uid,
          year: newYear,
          month: newMonth,
          total_credit: (nMData.total_credit || 0) + newCredit,
          total_debit: (nMData.total_debit || 0) + newDebit,
          net_change: ((nMData.total_credit || 0) + newCredit) - ((nMData.total_debit || 0) + newDebit),
        }, { merge: true });

        const nYData = newYearlyDoc.exists() ? newYearlyDoc.data() : { total_credit: 0, total_debit: 0 };
        transaction.set(newYearlySnapRef, {
          walletId: editTxWalletId,
          owner_id: user.uid,
          year: newYear,
          total_credit: (nYData.total_credit || 0) + newCredit,
          total_debit: (nYData.total_debit || 0) + newDebit,
          net_change: ((nYData.total_credit || 0) + newCredit) - ((nYData.total_debit || 0) + newDebit),
        }, { merge: true });

        // 5. Update transaction doc
        const txRef = doc(db, "wallet_transactions", editTxId);
        transaction.update(txRef, {
          time_transaction: newDate.toISOString(),
          wallet_id: editTxWalletId,
          category: editTxCategory,
          description: editTxDescription,
          credit: newCredit,
          debit: newDebit,
          updated_at: new Date().toISOString(),
        });
      });

      setOpenEditTx(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm("Are you sure you want to delete this transaction? Saldo dompet dan rekap akan ikut disesuaikan.")) return;
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || !user) return;

    const dateObj = new Date(tx.time_transaction);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    setSubmitting(true);
    try {
      const walletRef = doc(db, "wallets", tx.wallet_id);
      const transactionRef = doc(db, "wallet_transactions", txId);
      const monthlySnapRef = doc(db, "monthly_snaps", `${tx.wallet_id}_${year}_${month}`);
      const yearlySnapRef = doc(db, "yearly_snaps", `${tx.wallet_id}_${year}`);

      await runTransaction(db, async (transaction) => {
        // 1. Perform all reads first
        const walletDoc = await transaction.get(walletRef);
        const monthlySnapDoc = await transaction.get(monthlySnapRef);
        const yearlySnapDoc = await transaction.get(yearlySnapRef);

        if (!walletDoc.exists()) {
          throw new Error("Wallet does not exist!");
        }
        const wData = walletDoc.data();
        const currentBalance = wData.current_balance || 0;
        const totalTransactions = wData.total_transactions || 0;
        const totalCredit = wData.total_credit || 0;
        const totalDebit = wData.total_debit || 0;

        const creditVal = tx.credit || 0;
        const debitVal = tx.debit || 0;
        const newBalance = currentBalance - creditVal + debitVal;

        // 2. Perform all writes
        if (monthlySnapDoc.exists()) {
          const mData = monthlySnapDoc.data();
          transaction.set(monthlySnapRef, {
            total_credit: Math.max(0, (mData.total_credit || 0) - creditVal),
            total_debit: Math.max(0, (mData.total_debit || 0) - debitVal),
            net_change: Math.max(0, (mData.total_credit || 0) - creditVal) - Math.max(0, (mData.total_debit || 0) - debitVal),
          }, { merge: true });
        }

        if (yearlySnapDoc.exists()) {
          const yData = yearlySnapDoc.data();
          transaction.set(yearlySnapRef, {
            total_credit: Math.max(0, (yData.total_credit || 0) - creditVal),
            total_debit: Math.max(0, (yData.total_debit || 0) - debitVal),
            net_change: Math.max(0, (yData.total_credit || 0) - creditVal) - Math.max(0, (yData.total_debit || 0) - debitVal),
          }, { merge: true });
        }

        transaction.update(walletRef, {
          total_transactions: Math.max(0, totalTransactions - 1),
          total_credit: Math.max(0, totalCredit - creditVal),
          total_debit: Math.max(0, totalDebit - debitVal),
          current_balance: newBalance,
        });

        transaction.delete(transactionRef);
      });

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTransfer = () => {
    if (wallets.length < 2) {
      alert("Please create at least 2 wallets to transfer funds!");
      return;
    }
    setFromWalletId(wallets[0].id);
    setToWalletId(wallets[1].id);
    setTransferAmount(0);
    setTransferDescription("");
    setTransferTime(new Date().toISOString().substring(0, 16));
    setOpenTransfer(true);
  };

  const handleProcessTransfer = async () => {
    if (!fromWalletId || !toWalletId || transferAmount <= 0 || !user) return;
    if (fromWalletId === toWalletId) {
      alert("Source and destination wallets must be different.");
      return;
    }
    setSubmitting(true);
    try {
      const dateObj = new Date(transferTime);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;

      const fromWalletRef = doc(db, "wallets", fromWalletId);
      const toWalletRef = doc(db, "wallets", toWalletId);

      const fromTxRef = doc(collection(db, "wallet_transactions"));
      const toTxRef = doc(collection(db, "wallet_transactions"));

      const fromMonthlySnapRef = doc(db, "monthly_snaps", `${fromWalletId}_${year}_${month}`);
      const toMonthlySnapRef = doc(db, "monthly_snaps", `${toWalletId}_${year}_${month}`);

      const fromYearlySnapRef = doc(db, "yearly_snaps", `${fromWalletId}_${year}`);
      const toYearlySnapRef = doc(db, "yearly_snaps", `${toWalletId}_${year}`);

      await runTransaction(db, async (transaction) => {
        // 1. Perform all reads first
        const fromWalletDoc = await transaction.get(fromWalletRef);
        const toWalletDoc = await transaction.get(toWalletRef);
        const fromMonthlyDoc = await transaction.get(fromMonthlySnapRef);
        const toMonthlyDoc = await transaction.get(toMonthlySnapRef);
        const fromYearlyDoc = await transaction.get(fromYearlySnapRef);
        const toYearlyDoc = await transaction.get(toYearlySnapRef);

        if (!fromWalletDoc.exists() || !toWalletDoc.exists()) {
          throw new Error("One or both wallets do not exist.");
        }

        const fromData = fromWalletDoc.data();
        const toData = toWalletDoc.data();

        // 2. Calculate values
        const fromNewBalance = (fromData.current_balance || 0) - transferAmount;
        const toNewBalance = (toData.current_balance || 0) + transferAmount;

        let fromMCredit = 0, fromMDebit = 0;
        if (fromMonthlyDoc.exists()) {
          fromMCredit = fromMonthlyDoc.data().total_credit || 0;
          fromMDebit = fromMonthlyDoc.data().total_debit || 0;
        }

        let toMCredit = 0, toMDebit = 0;
        if (toMonthlyDoc.exists()) {
          toMCredit = toMonthlyDoc.data().total_credit || 0;
          toMDebit = toMonthlyDoc.data().total_debit || 0;
        }

        let fromYCredit = 0, fromYDebit = 0;
        if (fromYearlyDoc.exists()) {
          fromYCredit = fromYearlyDoc.data().total_credit || 0;
          fromYDebit = fromYearlyDoc.data().total_debit || 0;
        }

        let toYCredit = 0, toYDebit = 0;
        if (toYearlyDoc.exists()) {
          toYCredit = toYearlyDoc.data().total_credit || 0;
          toYDebit = toYearlyDoc.data().total_debit || 0;
        }

        // 3. Perform all writes
        transaction.update(fromWalletRef, {
          total_transactions: (fromData.total_transactions || 0) + 1,
          total_debit: (fromData.total_debit || 0) + transferAmount,
          current_balance: fromNewBalance,
        });

        transaction.update(toWalletRef, {
          total_transactions: (toData.total_transactions || 0) + 1,
          total_credit: (toData.total_credit || 0) + transferAmount,
          current_balance: toNewBalance,
        });

        transaction.set(fromTxRef, {
          time_transaction: dateObj.toISOString(),
          wallet_id: fromWalletId,
          user_id: user.uid,
          category: "Transfer",
          description: transferDescription || `Kirim saldo ke ${toData.name}`,
          credit: 0,
          debit: transferAmount,
          current_balance: fromNewBalance,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        transaction.set(toTxRef, {
          time_transaction: dateObj.toISOString(),
          wallet_id: toWalletId,
          user_id: user.uid,
          category: "Transfer",
          description: transferDescription || `Terima saldo dari ${fromData.name}`,
          credit: transferAmount,
          debit: 0,
          current_balance: toNewBalance,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        transaction.set(fromMonthlySnapRef, {
          walletId: fromWalletId,
          owner_id: user.uid,
          year,
          month,
          total_credit: fromMCredit,
          total_debit: fromMDebit + transferAmount,
          net_change: fromMCredit - (fromMDebit + transferAmount),
          final_balance: fromNewBalance,
        }, { merge: true });

        transaction.set(toMonthlySnapRef, {
          walletId: toWalletId,
          owner_id: user.uid,
          year,
          month,
          total_credit: toMCredit + transferAmount,
          total_debit: toMDebit,
          net_change: (toMCredit + transferAmount) - toMDebit,
          final_balance: toNewBalance,
        }, { merge: true });

        transaction.set(fromYearlySnapRef, {
          walletId: fromWalletId,
          owner_id: user.uid,
          year,
          total_credit: fromYCredit,
          total_debit: fromYDebit + transferAmount,
          net_change: fromYCredit - (fromYDebit + transferAmount),
          final_balance: fromNewBalance,
        }, { merge: true });

        transaction.set(toYearlySnapRef, {
          walletId: toWalletId,
          owner_id: user.uid,
          year,
          total_credit: toYCredit + transferAmount,
          total_debit: toYDebit,
          net_change: (toYCredit + transferAmount) - toYDebit,
          final_balance: toNewBalance,
        }, { merge: true });
      });

      setOpenTransfer(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to execute transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const activeTxs = selectedWalletId === "all" 
      ? transactions 
      : transactions.filter((t) => t.wallet_id === selectedWalletId);

    const headers = ["Tanggal", "Kategori", "Dompet", "Keterangan", "Debit", "Kredit"];
    const rows = activeTxs.map((tx) => [
      tx.time_transaction,
      tx.category,
      tx.wallet_name || "",
      tx.description,
      tx.debit > 0 ? tx.debit : "",
      tx.credit > 0 ? tx.credit : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finance_export_${selectedWalletId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Tanggal", "Kategori", "Dompet", "Keterangan", "Debit", "Kredit"];
    const exampleRow1 = ["2026-06-14 15:00", "Makanan", "Dompet Utama", "Makan siang", "75000", ""];
    const exampleRow2 = ["2026-06-14 16:30", "Gaji", "Dompet Utama", "Gaji Bulanan", "", "5000000"];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), exampleRow1.join(","), exampleRow2.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_keuangan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenImport = () => {
    if (wallets.length === 0) {
      alert("Please create a wallet first!");
      return;
    }
    setImportWalletId(selectedWalletId !== "all" ? selectedWalletId : wallets[0].id);
    setOpenImportDialog(true);
  };

  const handleImportCSVSubmit = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !importWalletId || !user) {
      alert("Please select a file and a destination wallet.");
      return;
    }

    setSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setSubmitting(false);
        return;
      }

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      lines.shift();

      let success = 0;
      let failed = 0;

      for (const line of lines) {
        const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts.length < 4) {
          failed++;
          continue;
        }

        const [tanggalStr, kategori, dompetNama, keterangan, debitStr, kreditStr] = parts;

        let targetWalletId = importWalletId;
        if (dompetNama) {
          const matchedWallet = wallets.find((w) => w.name.toLowerCase() === dompetNama.toLowerCase());
          if (matchedWallet) {
            targetWalletId = matchedWallet.id;
          }
        }

        let type: "credit" | "debit" = "debit";
        let amount = 0;

        const parseCurrency = (str: string): number => {
          if (!str) return 0;
          let clean = str.replace(/[^0-9.,-]/g, "").trim();
          if (!clean) return 0;
          if (clean.includes(",") && clean.includes(".")) {
            const lastComma = clean.lastIndexOf(",");
            const lastDot = clean.lastIndexOf(".");
            if (lastComma > lastDot) {
              clean = clean.replace(/\./g, "").replace(/,/g, ".");
            } else {
              clean = clean.replace(/,/g, "");
            }
          } else if (clean.includes(",")) {
            const parts = clean.split(",");
            if (parts.length === 2 && parts[1].length <= 2) {
              clean = clean.replace(/,/g, ".");
            } else {
              clean = clean.replace(/,/g, "");
            }
          } else if (clean.includes(".")) {
            const parts = clean.split(".");
            if (parts.length === 2 && parts[1].length <= 2) {
              // decimal
            } else {
              clean = clean.replace(/\./g, "");
            }
          }
          return parseFloat(clean) || 0;
        };

        const debitVal = parseCurrency(debitStr);
        const kreditVal = parseCurrency(kreditStr);

        if (kreditVal > 0) {
          type = "credit";
          amount = kreditVal;
        } else if (debitVal > 0) {
          type = "debit";
          amount = debitVal;
        } else {
          failed++;
          continue;
        }

        try {
          let formattedTime = tanggalStr;
          if (!tanggalStr || isNaN(Date.parse(tanggalStr))) {
            formattedTime = new Date().toISOString();
          }

          await recordTransactionAtomically({
            walletId: targetWalletId,
            category: kategori || "Lainnya",
            description: keterangan || "",
            type,
            amount,
            timeTransaction: formattedTime,
          });
          success++;
        } catch (err) {
          console.error("Row import error: ", line, err);
          failed++;
        }
      }

      setSubmitting(false);
      setOpenImportDialog(false);
      alert(`CSV Import Complete!\nSuccessfully imported: ${success}\nFailed/Skipped: ${failed}`);
      fetchData();
    };
    reader.readAsText(file);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  if (loading || !user) {
    return (
      <Box sx={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const activeWallets = selectedWalletId === "all" 
    ? wallets 
    : wallets.filter((w) => w.id === selectedWalletId);

  const activeTransactions = selectedWalletId === "all"
    ? transactions
    : transactions.filter((t) => t.wallet_id === selectedWalletId);

  const activeMonthlySnaps = selectedWalletId === "all"
    ? monthlySnaps
    : monthlySnaps.filter((s) => s.walletId === selectedWalletId);

  const activeYearlySnaps = selectedWalletId === "all"
    ? yearlySnaps
    : yearlySnaps.filter((s) => s.walletId === selectedWalletId);

  const totalBalance = activeWallets.reduce((acc, curr) => acc + curr.current_balance, 0);
  const totalCredits = activeWallets.reduce((acc, curr) => acc + curr.total_credit, 0);
  const totalDebits = activeWallets.reduce((acc, curr) => acc + curr.total_debit, 0);

  const currentWalletName = selectedWalletId === "all"
    ? "All Asset Wallets"
    : wallets.find((w) => w.id === selectedWalletId)?.name || "Specific Wallet";

  // Reconstruct chronological balance history backwards from the current active balance.
  const sortedTxs = [...activeTransactions]
    .sort((a, b) => new Date(a.time_transaction).getTime() - new Date(b.time_transaction).getTime());

  let runningTotal = totalBalance;
  const txsWithBalances: (WalletTransaction & { computed_balance: number })[] = [];
  for (let i = sortedTxs.length - 1; i >= 0; i--) {
    const tx = sortedTxs[i];
    txsWithBalances.unshift({
      ...tx,
      computed_balance: runningTotal,
    });
    runningTotal = runningTotal - (tx.credit || 0) + (tx.debit || 0);
  }

  // Group by YYYY-MM-DD, taking the latest transaction of each day for the daily closing balance
  interface DailyChartData {
    dateStr: string;
    dateObj: Date;
    balance: number;
    transactions: (WalletTransaction & { computed_balance: number })[];
  }

  const dailyBalancesMap: Record<string, DailyChartData> = {};

  txsWithBalances.forEach((tx) => {
    const date = new Date(tx.time_transaction);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dayKey = `${yyyy}-${mm}-${dd}`;

    if (!dailyBalancesMap[dayKey]) {
      dailyBalancesMap[dayKey] = {
        dateStr: dayKey,
        dateObj: date,
        balance: tx.computed_balance,
        transactions: [tx],
      };
    } else {
      // Overwrite with the latest transaction's computed balance for this day
      dailyBalancesMap[dayKey].balance = tx.computed_balance;
      dailyBalancesMap[dayKey].transactions.push(tx);
    }
  });

  const chartData: DailyChartData[] = Object.values(dailyBalancesMap)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const renderBalanceTrendChart = () => {
    if (chartData.length === 0) {
      return (
        <Box sx={{ display: "flex", height: 260, alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
          No transaction logs available to render trend line.
        </Box>
      );
    }

    const width = 600;
    const height = 220;
    const padding = { top: 20, right: 30, bottom: 30, left: 75 };

    const minVal = Math.min(...chartData.map((d) => d.balance), 0);
    const maxVal = Math.max(...chartData.map((d) => d.balance), 100000);
    const valRange = maxVal - minVal || 1;

    const getX = (index: number) => {
      if (chartData.length <= 1) return padding.left + (width - padding.left - padding.right) / 2;
      return padding.left + (index / (chartData.length - 1)) * (width - padding.left - padding.right);
    };

    const getY = (value: number) => {
      return padding.top + (1 - (value - minVal) / valRange) * (height - padding.top - padding.bottom);
    };

    const points = chartData.map((d, index) => `${getX(index)},${getY(d.balance)}`);
    const linePath = `M ${points.join(" L ")}`;

    const areaPath = `
      ${linePath}
      L ${getX(chartData.length - 1)},${height - padding.bottom}
      L ${getX(0)},${height - padding.bottom}
      Z
    `;

    return (
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 500 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <line x1={padding.left} y1={getY(minVal)} x2={width - padding.right} y2={getY(minVal)} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
          <line x1={padding.left} y1={getY(maxVal)} x2={width - padding.right} y2={getY(maxVal)} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
          <line x1={padding.left} y1={getY((minVal + maxVal) / 2)} x2={width - padding.right} y2={getY((minVal + maxVal) / 2)} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />

          <path d={areaPath} fill="url(#areaGradient)" />

          <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          <text x={padding.left - 12} y={getY(maxVal) + 4} fill={theme.palette.text.secondary} fontSize="10" textAnchor="end" fontWeight="500">
            {formatCurrency(maxVal)}
          </text>
          <text x={padding.left - 12} y={getY((minVal + maxVal) / 2) + 4} fill={theme.palette.text.secondary} fontSize="10" textAnchor="end" fontWeight="500">
            {formatCurrency((minVal + maxVal) / 2)}
          </text>
          <text x={padding.left - 12} y={getY(minVal) + 4} fill={theme.palette.text.secondary} fontSize="10" textAnchor="end" fontWeight="500">
            {formatCurrency(minVal)}
          </text>

          {chartData.map((d, idx) => (
            <g key={d.dateStr} className="chart-dot" style={{ cursor: "pointer" }}>
              <circle cx={getX(idx)} cy={getY(d.balance)} r="4" fill="#34d399" stroke="#0b0f19" strokeWidth="2" />
              <title>
                {`${d.dateObj.toLocaleDateString("id-ID")}\nClosing Balance: ${formatCurrency(d.balance)}\nTransactions: ${d.transactions.length}`}
              </title>
            </g>
          ))}

          {chartData.length > 0 && (
            <>
              <text x={padding.left} y={height - 8} fill={theme.palette.text.secondary} fontSize="9" textAnchor="start">
                {chartData[0].dateObj.toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
              </text>
              <text x={width - padding.right} y={height - 8} fill={theme.palette.text.secondary} fontSize="9" textAnchor="end">
                {chartData[chartData.length - 1].dateObj.toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
              </text>
            </>
          )}
        </svg>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", px: { xs: 0, lg: 1 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Cash & Finance
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your assets, run transfers, and track dynamic balances on local emulators.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {selectedWalletId !== "all" && (
            <Button variant="outlined" color="secondary" startIcon={<ClearIcon />} onClick={() => setSelectedWalletId("all")} sx={{ borderRadius: 2 }}>
              Clear Filter
            </Button>
          )}
          <Button variant="outlined" startIcon={<TransferIcon />} onClick={handleOpenTransfer} sx={{ borderRadius: 2 }} color="info">
            Transfer Dana
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenAddWallet} sx={{ borderRadius: 2 }}>
            New Wallet
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddTx} sx={{ borderRadius: 2, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#ffffff" }}>
            Add Transaction
          </Button>
        </Box>
      </Box>

      {/* Active Filter Header */}
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
            <WalletIcon color="primary" /> Dashboard View:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              sx={{ borderRadius: 2, bgcolor: "background.paper", fontWeight: 600 }}
            >
              <MenuItem value="all">All Wallets Summary</MenuItem>
              {wallets.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name} ({formatCurrency(w.current_balance)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="text" size="small" startIcon={<ExportIcon />} onClick={handleExportCSV} disabled={activeTransactions.length === 0}>
            Export CSV
          </Button>
          <Button variant="text" size="small" startIcon={<ImportIcon />} onClick={handleOpenImport}>
            Import CSV
          </Button>
        </Box>
      </Box>

      {/* Financial Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", borderRadius: 3, background: "rgba(17, 24, 39, 0.45)", backdropFilter: "blur(10px)" }}>
            <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 2.5 }}>
              <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#6366f1" }}>
                <WalletIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Current Asset Balance</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>{formatCurrency(totalBalance)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", borderRadius: 3, background: "rgba(17, 24, 39, 0.45)", backdropFilter: "blur(10px)" }}>
            <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 2.5 }}>
              <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <TrendingUp fontSize="large" />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Income (Credit)</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: "success.main" }}>{formatCurrency(totalCredits)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", borderRadius: 3, background: "rgba(17, 24, 39, 0.45)", backdropFilter: "blur(10px)" }}>
            <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 2.5 }}>
              <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <TrendingDown fontSize="large" />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Expenses (Debit)</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: "error.main" }}>{formatCurrency(totalDebits)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 2: Balance Trend Chart */}
      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid size={12}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <ChartIcon color="primary" /> Balance Trend Over Time ({currentWalletName})
              </Typography>
              {renderBalanceTrendChart()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 3: Transaction logs & Snap tables */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                Recent Transactions ({currentWalletName})
              </Typography>
              {activeTransactions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6 }}>
                  No transactions recorded for this selection.
                </Typography>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Wallet</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Category & Desc</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeTransactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                            {new Date(tx.time_transaction).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>
                            {wallets.find((w) => w.id === tx.wallet_id)?.name || "Unknown Wallet"}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{tx.category}</Typography>
                            <Typography variant="caption" color="text.secondary">{tx.description}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            {tx.credit > 0 ? (
                              <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>
                                + {formatCurrency(tx.credit)}
                              </Typography>
                            ) : (
                              <Typography variant="body2" sx={{ fontWeight: 700, color: "error.main" }}>
                                - {formatCurrency(tx.debit)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: "flex", justifyContent: "center" }}>
                              <IconButton color="primary" size="small" onClick={() => handleOpenEditTx(tx)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton color="error" size="small" onClick={() => handleDeleteTransaction(tx.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <AssessmentIcon color="primary" /> Monthly & Yearly Recaps ({currentWalletName})
              </Typography>
              
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>Monthly Snapshots</Typography>
              {activeMonthlySnaps.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, mb: 3 }}>No monthly snaps generated.</Typography>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ mb: 4 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Credit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Debit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Net Change</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeMonthlySnaps.map((snap) => (
                        <TableRow key={snap.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{snap.year}-{snap.month.toString().padStart(2, "0")}</TableCell>
                          <TableCell align="right" sx={{ color: "success.main", fontWeight: 500 }}>{formatCurrency(snap.total_credit)}</TableCell>
                          <TableCell align="right" sx={{ color: "error.main", fontWeight: 500 }}>{formatCurrency(snap.total_debit)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(snap.net_change)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>Yearly Snapshots</Typography>
              {activeYearlySnaps.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No yearly snaps generated.</Typography>
              ) : (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Year</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Credit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Debit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Net Change</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeYearlySnaps.map((snap) => (
                        <TableRow key={snap.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{snap.year}</TableCell>
                          <TableCell align="right" sx={{ color: "success.main", fontWeight: 500 }}>{formatCurrency(snap.total_credit)}</TableCell>
                          <TableCell align="right" sx={{ color: "error.main", fontWeight: 500 }}>{formatCurrency(snap.total_debit)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(snap.net_change)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Wallet Dialog */}
      <Dialog open={openAddWallet} onClose={() => setOpenAddWallet(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Wallet</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <TextField fullWidth label="Wallet Name" value={walletName} onChange={(e) => setWalletName(e.target.value)} required />
            <FormControl fullWidth>
              <InputLabel>Wallet Type</InputLabel>
              <Select value={walletType} label="Wallet Type" onChange={(e) => setWalletType(e.target.value as "cash" | "bank" | "ewallet" | "other")}>
                <MenuItem value="bank">Bank Account</MenuItem>
                <MenuItem value="cash">Cash / Physical Wallet</MenuItem>
                <MenuItem value="ewallet">E-Wallet (OVO, GoPay, etc.)</MenuItem>
                <MenuItem value="other">Other Assets</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth label="Initial Balance" type="number" value={initialBalance} onChange={(e) => setInitialBalance(Number(e.target.value))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddWallet(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateWallet} disabled={submitting || !walletName}>
            Create Wallet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={openAddTx} onClose={() => setOpenAddTx(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Record Financial Transaction</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Source Wallet</InputLabel>
              <Select value={txWalletId} label="Source Wallet" onChange={(e) => setTxWalletId(e.target.value)}>
                {wallets.map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name} ({formatCurrency(w.current_balance)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select value={txType} label="Transaction Type" onChange={(e) => setTxType(e.target.value as "credit" | "debit")}>
                    <MenuItem value="debit">Expenses (Debit)</MenuItem>
                    <MenuItem value="credit">Income (Credit)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <TextField fullWidth label="Amount (IDR)" type="number" value={txAmount} onChange={(e) => setTxAmount(Number(e.target.value))} required />
              </Grid>
            </Grid>
            <TextField fullWidth label="Category" placeholder="Food, Salary, Hosting, etc." value={txCategory} onChange={(e) => setTxCategory(e.target.value)} required />
            <TextField fullWidth label="Description" placeholder="Notes..." value={txDescription} onChange={(e) => setTxDescription(e.target.value)} />
            <TextField fullWidth label="Transaction Date" type="datetime-local" value={txTime} onChange={(e) => setTxTime(e.target.value)} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddTx(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTransaction} disabled={submitting || !txCategory || txAmount <= 0}>
            Save Transaction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={openEditTx} onClose={() => setOpenEditTx(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Transaction Details</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Wallet Source</InputLabel>
              <Select value={editTxWalletId} label="Wallet Source" onChange={(e) => setEditTxWalletId(e.target.value)}>
                {wallets.map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name} ({formatCurrency(w.current_balance)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select value={editTxType} label="Transaction Type" onChange={(e) => setEditTxType(e.target.value as "credit" | "debit")}>
                    <MenuItem value="debit">Expenses (Debit)</MenuItem>
                    <MenuItem value="credit">Income (Credit)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <TextField fullWidth label="Amount (IDR)" type="number" value={editTxAmount} onChange={(e) => setEditTxAmount(Number(e.target.value))} required />
              </Grid>
            </Grid>
            <TextField fullWidth label="Category" placeholder="Food, Salary, etc." value={editTxCategory} onChange={(e) => setEditTxCategory(e.target.value)} required />
            <TextField fullWidth label="Description" placeholder="Notes..." value={editTxDescription} onChange={(e) => setEditTxDescription(e.target.value)} />
            <TextField fullWidth label="Transaction Date" type="datetime-local" value={editTxTime} onChange={(e) => setEditTxTime(e.target.value)} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenEditTx(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateTransaction} disabled={submitting || !editTxCategory || editTxAmount <= 0}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Funds Dialog */}
      <Dialog open={openTransfer} onClose={() => setOpenTransfer(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Transfer Dana Antar Dompet</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth required>
                  <InputLabel>Dari Dompet (Source)</InputLabel>
                  <Select value={fromWalletId} label="Dari Dompet (Source)" onChange={(e) => setFromWalletId(e.target.value)}>
                    {wallets.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({formatCurrency(w.current_balance)})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth required>
                  <InputLabel>Ke Dompet (Destination)</InputLabel>
                  <Select value={toWalletId} label="Ke Dompet (Destination)" onChange={(e) => setToWalletId(e.target.value)}>
                    {wallets.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({formatCurrency(w.current_balance)})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField fullWidth label="Jumlah Transfer (IDR)" type="number" value={transferAmount} onChange={(e) => setTransferAmount(Number(e.target.value))} required />
            <TextField fullWidth label="Keterangan" placeholder="Catatan transfer..." value={transferDescription} onChange={(e) => setTransferDescription(e.target.value)} />
            <TextField fullWidth label="Tanggal Transfer" type="datetime-local" value={transferTime} onChange={(e) => setTransferTime(e.target.value)} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenTransfer(false)}>Batal</Button>
          <Button variant="contained" onClick={handleProcessTransfer} disabled={submitting || transferAmount <= 0 || fromWalletId === toWalletId} color="info">
            {submitting ? "Memindahkan..." : "Kirim Transfer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Import Transactions from CSV</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Destination Wallet (Fallback)</InputLabel>
              <Select value={importWalletId} label="Destination Wallet (Fallback)" onChange={(e) => setImportWalletId(e.target.value)}>
                {wallets.map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name} ({formatCurrency(w.current_balance)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              Upload a CSV file containing transactions. The importer matches Dompet column to your wallets automatically, falling back to the selected wallet if not matched.
            </Typography>
            <Button variant="outlined" size="small" onClick={handleDownloadTemplate} sx={{ alignSelf: "flex-start" }}>
              Download CSV Template
            </Button>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              style={{ marginTop: 8 }} 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleImportCSVSubmit} disabled={submitting || !importWalletId}>
            {submitting ? "Importing..." : "Upload & Parse"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
